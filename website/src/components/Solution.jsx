import React from 'react';
import { motion } from 'framer-motion';

const Solution = () => {
  return (
    <section className="dynamic-section border-b" id="solution">
      
      {/* ===================== ENGINE 01: PERSISTENT MEMORY ===================== */}
      <div style={{ gridColumn: '1 / 6', padding: '15vh 4vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 10 }} className="border-r border-b">
         <motion.div 
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="white-badge" style={{ marginBottom: '2vh' }}
         >
           ENGINE 01
         </motion.div>
         <motion.h2 
           initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
           className="large-type" style={{ fontSize: '3vw' }}
         >
           Persistent Memory Store
         </motion.h2>
         <motion.p 
           initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
           className="sub-type" style={{ maxWidth: '100%' }}
         >
           Keep track of project state across sessions and never start from zero again. A deterministic vector graph of your architectural decisions flowing continuously into your AI's context window.
         </motion.p>
      </div>

      <div style={{ gridColumn: '6 / 13', background: '#040405', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', position: 'relative', overflow: 'hidden' }} className="border-b">
          <div className="noise-overlay" />
          <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)', filter: 'blur(30px)' }} />
          
          <svg width="100%" height="100%" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
            <defs>
               <filter id="softGlow1" x="-20%" y="-20%" width="140%" height="140%">
                 <feGaussianBlur stdDeviation="3" result="blur" />
                 <feComposite in="SourceGraphic" in2="blur" operator="over" />
               </filter>
            </defs>

            {/* Continuous Horizontal Data Streams */}
            {[100, 200, 300, 400].map((y, i) => (
              <g key={`stream-${i}`}>
                {/* Static Background Rail */}
                <line x1="50" y1={y} x2="750" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
                
                {/* Infinite Flowing Data Packet */}
                <motion.line 
                  x1="50" y1={y} x2="750" y2={y} 
                  stroke="#8B5CF6" strokeWidth="2" filter="url(#softGlow1)"
                  strokeDasharray="60 1000"
                  animate={{ strokeDashoffset: [-100, 1000] }}
                  transition={{ repeat: Infinity, duration: 4 + (i*0.5), ease: "linear", delay: i*0.3 }}
                />
                
                {/* Infinitely Pulsating Intersection Nodes */}
                <motion.circle cx="400" cy={y} r="6" fill="#040405" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <motion.circle 
                  cx="400" cy={y} r="3" fill="#fff" 
                  animate={{ scale: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i*0.5, ease: "easeInOut" }}
                />

                {/* Looping Memory Labels */}
                <text x="50" y={y - 8} fill="var(--text-secondary)" fontSize="10" fontFamily="monospace">DATA_LANE_0{i+1}</text>
                <motion.text 
                  x="700" y={y - 8} fill="#27c93f" fontSize="10" fontFamily="monospace"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i*0.2 }}
                >
                  [ACTIVE]
                </motion.text>
              </g>
            ))}

            <motion.rect 
               x="370" y="60" width="60" height="380" rx="8" 
               fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"
               animate={{ borderColor: ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"] }}
               transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            />
         </svg>
      </div>

      {/* ===================== ENGINE 02: STRUCTURAL AST ===================== */}
      <div style={{ gridColumn: '1 / 8', background: '#040405', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', position: 'relative', overflow: 'hidden' }} className="border-r">
          <div className="noise-overlay" />
          <svg width="100%" height="100%" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
            <defs>
               <filter id="softGlow2" x="-20%" y="-20%" width="140%" height="140%">
                 <feGaussianBlur stdDeviation="3" result="blur" />
                 <feComposite in="SourceGraphic" in2="blur" operator="over" />
               </filter>
            </defs>

            {/* Static Ghost Network */}
            <path 
              d="M 400 100 L 400 250 M 400 250 L 200 400 M 400 250 L 600 400 M 200 400 L 100 500 M 200 400 L 300 500 M 600 400 L 500 500 M 600 400 L 700 500"
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"
            />
            
            {/* Infinitely Looping Network Scan Traces */}
            {[
              { path: "M 400 100 L 400 250 L 200 400 L 100 500", duration: 3 },
              { path: "M 400 100 L 400 250 L 600 400 L 700 500", duration: 3.5 },
              { path: "M 400 100 L 400 250 L 200 400 L 300 500", duration: 4 }
            ].map((route, i) => (
               <motion.path 
                 key={`scan-${i}`}
                 d={route.path}
                 fill="none" stroke="#8B5CF6" strokeWidth="1.5" filter="url(#softGlow2)"
                 strokeDasharray="40 1000"
                 animate={{ strokeDashoffset: [-100, 1000] }}
                 transition={{ repeat: Infinity, duration: route.duration, ease: "linear", delay: i*1.2 }}
               />
            ))}

            {/* Pulsating Nodes */}
            {[
              {x: 400, y: 100}, {x: 200, y: 400}, {x: 600, y: 400}, 
              {x: 100, y: 500}, {x: 300, y: 500}, {x: 500, y: 500}, {x: 700, y: 500}
            ].map((n, i) => (
              <g key={`node-${i}`}>
                {/* Core ring */}
                <motion.circle 
                  cx={n.x} cy={n.y} r="12" fill="#040405" stroke="rgba(255,255,255,0.2)" strokeWidth="1"
                  animate={{ r: [12, 16, 12], strokeOpacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 + (i*0.3), ease: "easeInOut" }}
                />
                {/* Inner dot */}
                <motion.circle 
                  cx={n.x} cy={n.y} r="4" fill="#fff" filter="url(#softGlow2)"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 + (i*0.2), ease: "easeInOut" }}
                />
                <motion.text 
                  x={n.x + 20} y={n.y + 4} fill="var(--text-secondary)" fontSize="10" fontFamily="monospace"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ repeat: Infinity, duration: 3, delay: i*0.1 }}
                >
                  NODE_{n.x}_{n.y}
                </motion.text>
              </g>
            ))}

         </svg>
      </div>
      
      <div style={{ gridColumn: '8 / 13', padding: '15vh 4vw', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
         <motion.div 
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="white-badge" style={{ marginBottom: '2vh' }}
         >
           ENGINE 02
         </motion.div>
         <motion.h2 
           initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
           className="large-type" style={{ fontSize: '3vw' }}
         >
           Structural Understanding
         </motion.h2>
         <motion.p 
           initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
           className="sub-type" style={{ maxWidth: '100%' }}
         >
           Ground code generation purely in files, symbols, definitions, and precise dependencies. No more blind edits or hallucinations.
         </motion.p>
      </div>

    </section>
  );
};

export default Solution;
