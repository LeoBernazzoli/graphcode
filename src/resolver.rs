use crate::model::{Node, NodeId};

/// Entity resolution: match new entities against existing ones.
pub struct EntityResolver {
    threshold: f64,
}

impl EntityResolver {
    pub fn new(threshold: f64) -> Self {
        Self { threshold }
    }

    /// Find the best matching existing node for a candidate name.
    /// Returns the node ID if a match is found above the threshold.
    pub fn resolve(&self, candidate_name: &str, existing_nodes: &[&Node]) -> Option<NodeId> {
        let candidate_norm = candidate_name.trim().to_lowercase();
        if candidate_norm.is_empty() {
            return None;
        }

        let mut best_match: Option<(NodeId, f64)> = None;

        for node in existing_nodes {
            for existing_name in node.all_names_normalized() {
                // Exact match
                if candidate_norm == existing_name {
                    return Some(node.id);
                }

                // Fuzzy match
                let similarity = self.sequence_similarity(&candidate_norm, &existing_name);
                if similarity >= self.threshold {
                    if best_match.is_none() || similarity > best_match.unwrap().1 {
                        best_match = Some((node.id, similarity));
                    }
                }
            }
        }

        best_match.map(|(id, _)| id)
    }

    /// SequenceMatcher-style similarity ratio.
    /// Uses longest common subsequence approach.
    fn sequence_similarity(&self, a: &str, b: &str) -> f64 {
        if a.is_empty() && b.is_empty() {
            return 1.0;
        }
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }

        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        let a_len = a_chars.len();
        let b_len = b_chars.len();

        // LCS dynamic programming
        let mut dp = vec![vec![0u32; b_len + 1]; a_len + 1];
        for i in 1..=a_len {
            for j in 1..=b_len {
                if a_chars[i - 1] == b_chars[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
                }
            }
        }

        let lcs_len = dp[a_len][b_len] as f64;
        2.0 * lcs_len / (a_len + b_len) as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Source;

    fn make_node(id: NodeId, name: &str, aliases: Vec<&str>) -> Node {
        let mut node = Node::new(
            id,
            name.to_string(),
            "concept".to_string(),
            String::new(),
            0.9,
            Source::Memory,
        );
        node.aliases = aliases.into_iter().map(String::from).collect();
        node
    }

    #[test]
    fn exact_match() {
        let resolver = EntityResolver::new(0.85);
        let node = make_node(1, "Marco Bianchi", vec![]);
        let nodes: Vec<&Node> = vec![&node];
        assert_eq!(resolver.resolve("Marco Bianchi", &nodes), Some(1));
        assert_eq!(resolver.resolve("marco bianchi", &nodes), Some(1));
    }

    #[test]
    fn alias_match() {
        let resolver = EntityResolver::new(0.85);
        let node = make_node(1, "Marco Bianchi", vec!["M. Bianchi", "Ing. Bianchi"]);
        let nodes: Vec<&Node> = vec![&node];
        assert_eq!(resolver.resolve("M. Bianchi", &nodes), Some(1));
        assert_eq!(resolver.resolve("ing. bianchi", &nodes), Some(1));
    }

    #[test]
    fn fuzzy_match() {
        let resolver = EntityResolver::new(0.80);
        let node = make_node(1, "Marco Bianchi", vec![]);
        let nodes: Vec<&Node> = vec![&node];
        assert_eq!(resolver.resolve("Marco Bianchii", &nodes), Some(1));
    }

    #[test]
    fn no_match() {
        let resolver = EntityResolver::new(0.85);
        let node = make_node(1, "Marco Bianchi", vec![]);
        let nodes: Vec<&Node> = vec![&node];
        assert_eq!(resolver.resolve("Sara Verdi", &nodes), None);
    }
}
