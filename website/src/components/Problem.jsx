import React from 'react';
import { motion } from 'framer-motion';

const Problem = () => {
  return (
    <section className="dynamic-section border-b sticky-wrapper">
      
      {/* Pinned Left Narrative */}
      <div className="sticky-nav">
         <div>
           <div className="white-badge" style={{ marginBottom: '2vh' }}>THE CORE PROBLEM</div>
           <h2 style={{ fontSize: '2vw', letterSpacing: '-0.03em', lineHeight: 1.2, color: 'var(--text-primary)' }}>
             Context is lost across sessions.
           </h2>
         </div>
         <div className="mono">↓ SCROLL</div>
      </div>

      {/* Floating Right Scroll Blocks */}
      <div className="scroll-content">
         
         <div className="scroll-block">
            <motion.div 
               initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
               style={{ display: 'inline-block', marginBottom: '4vh' }}
               className="mono crosshair"
            >
               01 / Context Loss
            </motion.div>
            <motion.h3 
               className="large-type" style={{ maxWidth: '40vw' }}
               initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
            >
               They forget the <br /> decisions you made <br /> yesterday.
            </motion.h3>
         </div>

         <div className="scroll-block">
            <motion.div 
               initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
               style={{ display: 'inline-block', marginBottom: '4vh' }}
               className="mono crosshair"
            >
               02 / Brittle Edits
            </motion.div>
            <motion.h3 
               className="large-type" style={{ maxWidth: '40vw' }}
               initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
            >
               They edit code <br /> without computing <br /> the blast radius.
            </motion.h3>
         </div>

         <div className="scroll-block" style={{ borderBottom: 'none', background: 'var(--text-primary)' }}>
            <motion.div 
               initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
               style={{ display: 'inline-block', marginBottom: '4vh', color: 'var(--bg-primary)' }}
               className="mono crosshair"
            >
               03 / The Engine
            </motion.div>
            <motion.h3 
               className="large-type" style={{ maxWidth: '40vw', color: 'var(--bg-primary)' }}
               initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
            >
               We inject a deterministic <br /> memory map directly <br /> into your LLM.
            </motion.h3>
         </div>

      </div>
    </section>
  );
};

export default Problem;
