import React from 'react';
import { motion } from 'framer-motion';

const HowItWorks = () => {
  const steps = [
    { num: "01", title: "Ingest Context", desc: "Autoclaw scans your repo and reads history." },
    { num: "02", title: "Build Graph", desc: "It constructs a structural relationship of symbols." },
    { num: "03", title: "Surface Insights", desc: "Injects precisely the right data into the LLM." }
  ];

  return (
    <section id="how-it-works" className="section-pad" style={{ borderBottom: '1px solid var(--border-color)' }}>
       <div className="container">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '80px' }}>
          <div>
            <span className="label-mono">The Engine</span>
            <motion.h2 
              className="section-title text-gradient"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ margin: 0, marginTop: '16px' }}
            >
              One product. <br /> Two engines.
            </motion.h2>
          </div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '400px' }}
          >
            A memory engine and a code understanding engine, fused into a single reliability layer.
          </motion.p>
        </div>

        {/* Linear style timeline / stepper across the grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', position: 'relative' }}>
          {/* Continuous top line */}
          <div style={{ position: 'absolute', top: '0', left: '0', right: '0', height: '1px', background: 'var(--border-color)' }}></div>
          
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              style={{ paddingTop: '40px', paddingRight: '40px', position: 'relative' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
            >
              {/* Highlight notch on the line */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '2px', background: 'var(--text-primary)' }}></div>
              
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '16px' }}>{step.num}</div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px' }}>{step.title}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
