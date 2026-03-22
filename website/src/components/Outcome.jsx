import React from 'react';
import { motion } from 'framer-motion';

const Outcome = () => {
  return (
    <section id="outcome" className="section-pad" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 100%)' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <motion.h2 
          className="text-gradient"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ fontSize: '80px', fontWeight: '800', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '60px' }}
        >
          Make AI coding tools <br /> 
          <span style={{ color: 'var(--text-secondary)' }}>more reliable.</span>
        </motion.h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {["Stay on track longer", "Make fewer blind changes", "Carry project context forward", "Reduce repeated prompting", "Scale to large codebases"].map((bullet, i) => (
            <motion.div 
              key={i} 
              style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '99px', fontSize: '16px', fontWeight: '500' }}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              {bullet}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Outcome;
