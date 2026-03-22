import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, BookX, ShieldAlert, Cpu } from 'lucide-react';

const Problem = () => {
  const problems = [
    {
      num: "01",
      title: "Context disappears",
      desc: "Every new chat session starts from zero. You spend half your time re-explaining the architecture instead of writing code.",
      icon: <BookX size={24} strokeWidth={1.5} />
    },
    {
      num: "02",
      title: "Decisions get forgotten",
      desc: "Why was this pattern chosen? The AI doesn't remember the debate from last week. Context is lost between isolated prompts.",
      icon: <BrainCircuit size={24} strokeWidth={1.5} />
    },
    {
      num: "03",
      title: "Changes become risky",
      desc: "Without structural awareness, the AI breaks dependencies it can't see, shifting the burden of QA back to you.",
      icon: <ShieldAlert size={24} strokeWidth={1.5} />
    },
    {
      num: "04",
      title: "Control is lost",
      desc: "As the codebase grows, the AI workflow shifts from productive to fragile. You start fearing the next blind code generation.",
      icon: <Cpu size={24} strokeWidth={1.5} />
    }
  ];

  return (
    <section id="problem" className="section-pad" style={{ borderTop: '1px solid var(--border-color)', position: 'relative' }}>
      <div className="container">
        <div style={{ marginBottom: '80px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <span className="label-mono">The Problem</span>
          <motion.h2 
            className="section-title text-gradient"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            AI coding tools can write code. <br />
            They still lose the plot.
          </motion.h2>
          <motion.p 
            className="section-desc"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
            style={{ margin: 0 }}
          >
            They forget decisions, lose context across sessions, and edit files without really understanding the codebase. The bigger the project gets, the more fragile the workflow becomes.
          </motion.p>
        </div>

        {/* Linear style list instead of grid of boxes */}
        <div className="linear-list">
          {problems.map((prob, i) => (
            <motion.div 
              key={i}
              className="list-item"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1 }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <span className="label-mono" style={{ opacity: 0.5 }}>{prob.num}</span>
                  <div className="list-item-icon">{prob.icon}</div>
                </div>
                <h3>{prob.title}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <p>{prob.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Problem;
