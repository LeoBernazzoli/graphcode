/// Text chunking with overlap for knowledge extraction.
/// Chunks at sentence boundaries to avoid splitting entities mid-sentence.

/// A chunk of text with metadata.
#[derive(Debug, Clone)]
pub struct Chunk {
    pub text: String,
    pub index: usize,
    pub start_offset: usize,
    pub end_offset: usize,
}

/// Split text into overlapping chunks at sentence boundaries.
///
/// - `target_size`: target characters per chunk
/// - `overlap`: characters of overlap between consecutive chunks
pub fn chunk_text(text: &str, target_size: usize, overlap: usize) -> Vec<Chunk> {
    if text.is_empty() {
        return Vec::new();
    }
    if text.len() <= target_size {
        return vec![Chunk {
            text: text.to_string(),
            index: 0,
            start_offset: 0,
            end_offset: text.len(),
        }];
    }

    let sentences = split_sentences(text);
    if sentences.is_empty() {
        return vec![Chunk {
            text: text.to_string(),
            index: 0,
            start_offset: 0,
            end_offset: text.len(),
        }];
    }

    // Build chunks greedily, then add overlap by extending each chunk backwards
    let mut raw_chunks: Vec<(usize, usize)> = Vec::new(); // (first_sent, last_sent) inclusive
    let mut i = 0;
    while i < sentences.len() {
        let first = i;
        let mut char_count = 0;
        while i < sentences.len() {
            let (s, e) = sentences[i];
            let sent_len = e - s;
            if char_count > 0 && char_count + sent_len > target_size {
                break;
            }
            char_count += sent_len;
            i += 1;
        }
        // Ensure progress: always consume at least one sentence
        if i == first {
            i = first + 1;
        }
        raw_chunks.push((first, i - 1));
    }

    // Now build final chunks with overlap
    let mut chunks = Vec::new();
    for (idx, &(first, last)) in raw_chunks.iter().enumerate() {
        // Extend backwards for overlap (except first chunk)
        let actual_first = if idx > 0 && overlap > 0 {
            let mut extended = first;
            let mut overlap_chars = 0;
            while extended > 0 {
                let prev = extended - 1;
                let (s, e) = sentences[prev];
                overlap_chars += e - s;
                if overlap_chars > overlap {
                    break;
                }
                extended = prev;
                // Don't overlap past the start of the previous chunk
                if prev <= raw_chunks[idx - 1].0 {
                    break;
                }
            }
            extended
        } else {
            first
        };

        let start_offset = sentences[actual_first].0;
        let end_offset = sentences[last].1;
        let chunk_str = text[start_offset..end_offset].trim().to_string();

        if !chunk_str.is_empty() {
            chunks.push(Chunk {
                text: chunk_str,
                index: chunks.len(),
                start_offset,
                end_offset,
            });
        }
    }

    chunks
}

/// Split text into sentences. Returns (start, end) byte offsets.
fn split_sentences(text: &str) -> Vec<(usize, usize)> {
    let mut sentences = Vec::new();
    let mut start = 0;

    let bytes = text.as_bytes();
    let len = bytes.len();

    let mut i = 0;
    while i < len {
        let ch = bytes[i];

        // Sentence boundary: .!? followed by whitespace, with >20 chars since last split
        let is_sentence_end = (ch == b'.' || ch == b'!' || ch == b'?')
            && i + 1 < len
            && (bytes[i + 1] == b' ' || bytes[i + 1] == b'\n' || bytes[i + 1] == b'\r')
            && (i - start) > 20;

        // Paragraph break: double newline
        let is_para_break = ch == b'\n' && i + 1 < len && bytes[i + 1] == b'\n';

        if is_sentence_end || is_para_break {
            let end = i + 1; // include the punctuation
            if end > start {
                let segment = text[start..end].trim();
                if !segment.is_empty() {
                    sentences.push((start, end));
                }
            }
            start = end;
            // Skip whitespace
            while start < len && (bytes[start] == b' ' || bytes[start] == b'\n' || bytes[start] == b'\r') {
                start += 1;
            }
            i = start;
            continue;
        }

        i += 1;
    }

    // Last segment
    if start < len {
        let segment = text[start..].trim();
        if !segment.is_empty() {
            sentences.push((start, len));
        }
    }

    sentences
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_chunk() {
        let chunks = chunk_text("Hello world.", 1000, 200);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].index, 0);
    }

    #[test]
    fn test_empty() {
        let chunks = chunk_text("", 1000, 200);
        assert_eq!(chunks.len(), 0);
    }

    #[test]
    fn test_multiple_chunks() {
        let text = "This is the first sentence with enough content to be detected properly. This is the second sentence which also has plenty of words in it. The third sentence continues with more detailed information about the topic. Finally the fourth sentence wraps up the entire paragraph nicely.";
        let chunks = chunk_text(text, 100, 30);
        assert!(chunks.len() >= 2, "Expected at least 2 chunks, got {}", chunks.len());
        for chunk in &chunks {
            assert!(!chunk.text.is_empty());
        }
    }

    #[test]
    fn test_short_sentences() {
        // This was causing infinite loops before
        let text = "Short one. Another. Third one here. Fourth.";
        let chunks = chunk_text(text, 20, 5);
        assert!(!chunks.is_empty());
        // Must terminate (the real test is that it doesn't hang)
    }

    #[test]
    fn test_overlap_has_shared_content() {
        let sentences: Vec<String> = (0..10)
            .map(|i| format!("This is sentence number {} with some extra content to fill space here.", i))
            .collect();
        let text = sentences.join(" ");

        let chunks = chunk_text(&text, 200, 100);
        if chunks.len() >= 2 {
            let c1_words: std::collections::HashSet<&str> =
                chunks[0].text.split_whitespace().collect();
            let c2_words: std::collections::HashSet<&str> =
                chunks[1].text.split_whitespace().collect();
            let shared = c1_words.intersection(&c2_words).count();
            assert!(shared > 0, "Overlapping chunks should share some words");
        }
    }

    #[test]
    fn test_chunk_offsets() {
        let text = "This is a fairly long first sentence for testing. This is the second sentence for more testing. And a third one.";
        let chunks = chunk_text(text, 60, 10);
        for chunk in &chunks {
            assert!(chunk.start_offset <= chunk.end_offset);
            assert!(chunk.end_offset <= text.len());
        }
    }
}
