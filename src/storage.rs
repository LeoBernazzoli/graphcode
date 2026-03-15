use crate::graph::KnowledgeGraph;
use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;
use thiserror::Error;

const MAGIC: &[u8; 6] = b"AUTOKG";
const VERSION: u16 = 1;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("serialization error: {0}")]
    Serialize(#[from] rmp_serde::encode::Error),
    #[error("deserialization error: {0}")]
    Deserialize(#[from] rmp_serde::decode::Error),
    #[error("invalid file format: {0}")]
    InvalidFormat(String),
    #[error("unsupported version: {0}")]
    UnsupportedVersion(u16),
}

/// Save a KnowledgeGraph to a .kg file (MessagePack binary).
pub fn save(kg: &KnowledgeGraph, path: &Path) -> Result<(), StorageError> {
    let mut buf: Vec<u8> = Vec::new();

    // Header
    buf.extend_from_slice(MAGIC);
    buf.extend_from_slice(&VERSION.to_le_bytes());

    // Body: MessagePack serialized graph
    let body = rmp_serde::to_vec(kg)?;
    let body_len = body.len() as u64;
    buf.extend_from_slice(&body_len.to_le_bytes());
    buf.extend_from_slice(&body);

    // Write atomically: write to temp file, then rename
    let temp_path = path.with_extension("kg.tmp");
    let mut file = fs::File::create(&temp_path)?;
    file.write_all(&buf)?;
    file.sync_all()?;
    fs::rename(&temp_path, path)?;

    Ok(())
}

/// Load a KnowledgeGraph from a .kg file.
pub fn load(path: &Path) -> Result<KnowledgeGraph, StorageError> {
    let mut file = fs::File::open(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;

    if buf.len() < 8 {
        return Err(StorageError::InvalidFormat("file too small".into()));
    }

    // Check magic
    if &buf[0..6] != MAGIC {
        return Err(StorageError::InvalidFormat("invalid magic bytes".into()));
    }

    // Check version
    let version = u16::from_le_bytes([buf[6], buf[7]]);
    if version != VERSION {
        return Err(StorageError::UnsupportedVersion(version));
    }

    // Read body length
    if buf.len() < 16 {
        return Err(StorageError::InvalidFormat("missing body length".into()));
    }
    let body_len = u64::from_le_bytes(buf[8..16].try_into().unwrap()) as usize;

    if buf.len() < 16 + body_len {
        return Err(StorageError::InvalidFormat("truncated body".into()));
    }

    let body = &buf[16..16 + body_len];
    let kg: KnowledgeGraph = rmp_serde::from_slice(body)?;

    Ok(kg)
}

/// Load or create a new KnowledgeGraph.
pub fn load_or_create(path: &Path) -> Result<KnowledgeGraph, StorageError> {
    if path.exists() {
        load(path)
    } else {
        Ok(KnowledgeGraph::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::*;
    use tempfile::TempDir;

    #[test]
    fn test_save_and_load() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.kg");

        let mut kg = KnowledgeGraph::new();
        let n1 = Node::new(
            0,
            "Test Entity".into(),
            "concept".into(),
            "A test concept".into(),
            0.9,
            Source::Memory,
        );
        kg.add_node(n1).unwrap();

        save(&kg, &path).unwrap();
        assert!(path.exists());

        let loaded = load(&path).unwrap();
        assert_eq!(loaded.nodes.len(), 1);
        assert!(loaded.lookup("Test Entity").is_some());
    }

    #[test]
    fn test_load_or_create_new() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("new.kg");
        let kg = load_or_create(&path).unwrap();
        assert_eq!(kg.nodes.len(), 0);
    }

    #[test]
    fn test_invalid_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bad.kg");
        fs::write(&path, b"not a kg file").unwrap();
        assert!(load(&path).is_err());
    }
}
