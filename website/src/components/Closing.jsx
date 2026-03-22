import React from 'react';
import { motion } from 'framer-motion';

const Closing = () => {
  return (
    <footer style={{ paddingTop: '160px', paddingBottom: '60px', textAlign: 'center', borderTop: '1px solid var(--border-color)', position: 'relative' }}>
      <div className="hero-glow" style={{ opacity: 0.5, top: '-250px' }} />
      <div className="container">
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           transition={{ duration: 0.8 }}
        >
          <h2 className="text-gradient" style={{ fontSize: '64px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '24px', lineHeight: 1.1 }}>
            Your AI coding tool is missing <br /> memory and code understanding.
          </h2>
          <p style={{ fontSize: '24px', color: 'var(--text-secondary)', marginBottom: '40px' }}>
            Autoclaw adds both. Start building with confidence.
          </p>
          <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '16px' }}>Start Using Autoclaw</button>
        </motion.div>

        <div style={{ marginTop: '160px', paddingTop: '40px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
          <div>© {new Date().getFullYear()} Autoclaw. Open source.</div>
          <div style={{ display: 'flex', gap: '32px' }}>
            <a href="#github" style={{ transition: 'color 0.2s' }}>GitHub</a>
            <a href="#twitter" style={{ transition: 'color 0.2s' }}>Twitter</a>
            <a href="#docs" style={{ transition: 'color 0.2s' }}>Documentation</a>
            <a href="#linear" style={{ transition: 'color 0.2s' }}>Changelog</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Closing;
