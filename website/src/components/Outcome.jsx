import React from 'react';
import { motion } from 'framer-motion';

const Outcome = () => {
  return (
    <section style={{ 
      background: 'var(--bg-primary)', color: '#fff', minHeight: '80vh', 
      padding: '15vh 4vw', display: 'flex', flexDirection: 'column', 
      justifyContent: 'center', alignItems: 'center', 
      borderBottom: '1vw solid #fff' 
    }}>
      
      <motion.div 
        className="mono" style={{ marginBottom: '4vh', opacity: 0.5 }}
        initial={{ opacity: 0 }} whileInView={{ opacity: 0.5 }} viewport={{ once: true }}
      >
        [ AUTOCLAW v1.0 / ALPHA ]
      </motion.div>
      
      <motion.h1 
        className="mega-type text-gradient" style={{ textAlign: 'center', fontSize: '7vw', lineHeight: 0.9 }}
        initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        Stop <br /> Guessing.
      </motion.h1>
      
      <motion.div 
        style={{ marginTop: '8vh', display: 'flex', gap: '2vw', alignItems: 'center' }}
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        transition={{ delay: 0.2 }}
      >
        <a href="https://github.com/autoclaw" target="_blank" rel="noreferrer" style={{ border: '1px solid #fff', padding: '1.5vw 3vw', background: '#fff', color: '#111', fontWeight: 'bold', fontSize: '1.2vw', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1}>
           View on GitHub
        </a>
        <a href="#how-it-works" className="mono" style={{ color: '#fff', padding: '1.5vw 3vw', border: '1px solid rgba(255,255,255,0.2)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
           Read Docs
        </a>
      </motion.div>
      
    </section>
  );
};

export default Outcome;
