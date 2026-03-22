import React from 'react';
import { motion } from 'framer-motion';

const HowItWorks = () => {
  return (
    <section className="border-b" style={{ padding: '15vh 4vw' }} id="how-it-works">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10vh', borderBottom: '1px solid var(--border-color)', paddingBottom: '2vh' }}>
        <motion.h2 
          className="mega-type" style={{ fontSize: '5vw' }}
          initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
        >
          The Workflow
        </motion.h2>
        <motion.div 
          className="white-badge"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          CLI INTEGRATION
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2vw' }}>
        
        {/* Step 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0 }}
          style={{ borderTop: '2px solid var(--text-primary)', paddingTop: '2vh' }}
        >
           <div className="mono" style={{ marginBottom: '1vh', color: '#fff' }}>01 / INIT</div>
           <h3 style={{ fontSize: '1.2vw', fontFamily: 'monospace', color: 'var(--text-primary)' }}>$ autoclaw init</h3>
           <p className="sub-type" style={{ fontSize: '1vw', maxWidth: '100%', marginTop: '1vh' }}>
             Indexes project into local .kg graph instantly.
           </p>
        </motion.div>

        {/* Step 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          style={{ borderTop: '2px solid var(--text-primary)', paddingTop: '2vh' }}
        >
           <div className="mono" style={{ marginBottom: '1vh', color: '#fff' }}>02 / SYNC</div>
           <h3 style={{ fontSize: '1.2vw', fontFamily: 'monospace', color: 'var(--text-primary)' }}>$ autoclaw sync-rules</h3>
           <p className="sub-type" style={{ fontSize: '1vw', maxWidth: '100%', marginTop: '1vh' }}>
             Generates path-specific AI prompting constraints.
           </p>
        </motion.div>

        {/* Step 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
          style={{ borderTop: '2px solid var(--text-primary)', paddingTop: '2vh' }}
        >
           <div className="mono" style={{ marginBottom: '1vh', color: '#fff' }}>03 / IMPACT</div>
           <h3 style={{ fontSize: '1.2vw', fontFamily: 'monospace', color: 'var(--text-primary)' }}>$ autoclaw impact</h3>
           <p className="sub-type" style={{ fontSize: '1vw', maxWidth: '100%', marginTop: '1vh' }}>
             Validates blast-radius before code changes are made.
           </p>
        </motion.div>

        {/* Step 4 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
          style={{ borderTop: '2px solid var(--text-primary)', paddingTop: '2vh' }}
        >
           <div className="mono" style={{ marginBottom: '1vh', color: '#fff' }}>04 / QUERY</div>
           <h3 style={{ fontSize: '1.2vw', fontFamily: 'monospace', color: 'var(--text-primary)' }}>$ autoclaw relevant</h3>
           <p className="sub-type" style={{ fontSize: '1vw', maxWidth: '100%', marginTop: '1vh' }}>
             Pulls targeted context for Claude/Codex instantly.
           </p>
        </motion.div>

      </div>

    </section>
  );
};

export default HowItWorks;
