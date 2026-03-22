import React from 'react';
import { motion } from 'framer-motion';

const Hero = () => {
  const nodes = [
    { id: 'root', x: 500, y: 150, label: 'src/main.rs', type: 'core' },
    
    { id: 'cli', x: 300, y: 400, label: 'cli/mod.rs', type: 'module' },
    { id: 'engine', x: 700, y: 400, label: 'graph/engine.rs', type: 'module' },
    
    { id: 'parser', x: 200, y: 700, label: 'parser/ast.rs', type: 'file' },
    { id: 'config', x: 400, y: 700, label: 'config/env.rs', type: 'file' },
    
    { id: 'memory', x: 600, y: 700, label: 'memory/store.rs', type: 'file' },
    { id: 'storage', x: 800, y: 700, label: 'storage/disk.rs', type: 'file' },
    
    { id: 'leaf1', x: 150, y: 1000, label: 'lexer.rs', type: 'leaf' },
    { id: 'leaf2', x: 250, y: 1000, label: 'tokens.rs', type: 'leaf' },
    
    { id: 'leaf3', x: 550, y: 1000, label: 'vector.rs', type: 'leaf' },
    { id: 'leaf4', x: 650, y: 1000, label: 'cache.rs', type: 'leaf' },
    { id: 'leaf5', x: 850, y: 1000, label: 'io.rs', type: 'leaf' },
  ];

  const edges = [
    { from: 'root', to: 'cli' },
    { from: 'root', to: 'engine' },
    
    { from: 'cli', to: 'parser' },
    { from: 'cli', to: 'config' },
    
    { from: 'engine', to: 'memory' },
    { from: 'engine', to: 'storage' },
    
    { from: 'parser', to: 'leaf1' },
    { from: 'parser', to: 'leaf2' },
    
    { from: 'memory', to: 'leaf3' },
    { from: 'memory', to: 'leaf4' },
    
    { from: 'storage', to: 'leaf5' },
  ];

  const getNode = (id) => nodes.find(n => n.id === id);

  const drawBezier = (x1, y1, x2, y2) => {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1 + 14} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2 - 14}`;
  };

  return (
    <section className="hero-split border-b">
      
      {/* Editorial Navigation Index */}
      <div className="hero-left">
         <motion.div 
           className="mono" 
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
           style={{ position: 'absolute', top: '12vh', left: '4vw', color: 'var(--text-primary)' }}
         >
           AUTOCLAW 1.0
         </motion.div>

         <motion.h1 
           className="mega-type text-gradient"
           initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
           animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
           transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
         >
           Stop <br /> Working <br /> Blindly.
         </motion.h1>

         <motion.p 
           className="sub-type"
           initial={{ opacity: 0, y: 15 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
         >
           AI coding tools don't understand your codebase without persistent memory and a structural AST graph.
         </motion.p>
         
         <motion.div 
           initial={{ opacity: 0, y: 15 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
           style={{ marginTop: '5vh', display: 'flex', gap: '2vw', alignItems: 'center' }}
         >
            <button className="btn btn-primary">Get Started</button>
            <div className="mono" style={{ border: '1px solid var(--border-color)', padding: '1vw 2vw', color: '#fff' }}>
               <span style={{ color: '#27c93f' }}>$</span> cargo install autoclaw
            </div>
         </motion.div>

         <div style={{ position: 'absolute', left: 0, top: '50%', width: '100%', height: '1px', borderBottom: '1px dashed rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      </div>

      {/* Vast SVG Canvas */}
      <div className="hero-right-visual">
         <div className="noise-overlay" />
         
         <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 60%)', filter: 'blur(50px)' }} />

         <div className="mono" style={{ position: 'absolute', bottom: '4vh', right: '4vw', opacity: 0.5, zIndex: 10 }}>
            Active Nodes: 12
         </div>

         <motion.svg 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 0.5 }}
            width="100%" height="100%" viewBox="0 0 1000 1200" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"
         >
            <defs>
              <filter id="crispGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Bezier edges */}
            {edges.map((edge, i) => {
              const start = getNode(edge.from);
              const end = getNode(edge.to);
              return (
                <motion.path 
                  key={`edge-${i}`}
                  d={drawBezier(start.x, start.y, end.x, end.y)}
                  fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, delay: 0.8 + (i * 0.1), ease: "easeInOut" }}
                />
              )
            })}

            {/* Glowing Traces */}
            {edges.map((edge, i) => {
              const start = getNode(edge.from);
              const end = getNode(edge.to);
              return (
                <motion.path 
                  key={`trace-${i}`}
                  d={drawBezier(start.x, start.y, end.x, end.y)}
                  fill="none" stroke="#8B5CF6" strokeWidth="2" filter="url(#crispGlow)"
                  strokeDasharray="40 1000"
                  initial={{ strokeDashoffset: -100, opacity: 0 }}
                  animate={{ strokeDashoffset: 1000, opacity: [0, 1, 0] }}
                  transition={{ duration: 3, delay: 2 + (i * 0.4), ease: "linear", repeat: Infinity }}
                />
              )
            })}

            {/* Nodes array */}
            {nodes.map((node, i) => (
              <g key={`node-${i}`}>
                 {/* Outer Radar Loop */}
                 <motion.circle 
                    cx={node.x} cy={node.y} r="20" 
                    fill="var(--bg-primary)" stroke={node.type === 'core' ? '#fff' : "rgba(255,255,255,0.2)"} strokeWidth="2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 1 + (i * 0.05), type: "spring", stiffness: 200 }}
                 />
                 {/* Inner Dot */}
                 <motion.circle 
                    cx={node.x} cy={node.y} r="6" fill={node.type === 'core' ? '#fff' : "var(--text-secondary)"} 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 1.2 + (i * 0.05), type: "spring" }}
                 />
                 {/* Floating Label */}
                 <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 1.4 + (i * 0.05) }}>
                   <rect x={node.x + 28} y={node.y - 14} width={node.label.length * 8 + 20} height="28" rx="6" fill="rgba(10,10,12,0.9)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                   <text x={node.x + 38} y={node.y + 4} fill={node.type === 'core' ? "#fff" : "var(--text-primary)"} fontSize="13" fontFamily="monospace" letterSpacing="0.05em">{node.label}</text>
                 </motion.g>
              </g>
            ))}
         </motion.svg>
      </div>

    </section>
  );
};

export default Hero;
