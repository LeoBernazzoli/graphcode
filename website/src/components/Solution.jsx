import React from 'react';
import { motion } from 'framer-motion';

const Solution = () => {
  return (
    <section id="solution" style={{ padding: 0 }}>
      {/* Feature 1: Persistent Memory */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '600px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ padding: '80px 100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid var(--border-color)' }}>
           <h3 
             style={{ fontSize: '40px', fontWeight: '600', letterSpacing: '-0.03em', marginBottom: '24px', lineHeight: 1.15 }}
             className="text-gradient"
           >
             Persistent memory <br /> across sessions.
           </h3>
           <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
             Keep track of architectural decisions, project state, and conversation history. Stop re-explaining context and never start from scratch again.
           </p>
        </div>
        
        {/* SVG UI Mockup for Memory */}
        <div style={{ background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          {/* Subtle glow underneath */}
          <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'rgba(255,255,255,0.03)', filter: 'blur(100px)' }} />
          
          <div style={{ width: '400px', height: '300px', background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 1 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Context Engine</span>
              <span style={{ color: '#27c93f' }}>Active</span>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#fff', marginBottom: '4px' }}>Session A (Yesterday)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Decided: using standard CSS, no Tailwind.</div>
               </div>
               <svg height="20" width="100%">
                  <path d="M 20 0 L 20 20" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="4 4" />
                  <polygon points="16,20 24,20 20,28" fill="rgba(255,255,255,0.2)" />
               </svg>
               <div style={{ padding: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#fff', marginBottom: '4px' }}>Session B (Today)</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>Context injected successfully.</div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 2: Code Understanding */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '600px', borderBottom: '1px solid var(--border-color)' }}>
        {/* SVG UI Mockup for Code Understanding */}
        <div style={{ background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'rgba(255,255,255,0.03)', filter: 'blur(100px)' }} />
          
          <div style={{ width: '400px', height: '300px', background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 1 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Dependency Graph
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
               <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                 {/* Tree structure */}
                 <polyline points="200,40 200,80 100,80 100,120" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                 <polyline points="200,80 300,80 300,120" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                 
                 {/* Nodes */}
                 <rect x="150" y="20" width="100" height="30" rx="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
                 <text x="200" y="39" fill="#fff" fontSize="12" textAnchor="middle" fontFamily="monospace">App.jsx</text>

                 <rect x="50" y="120" width="100" height="30" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
                 <text x="100" y="139" fill="var(--text-secondary)" fontSize="12" textAnchor="middle" fontFamily="monospace">Header.tsx</text>

                 <rect x="250" y="120" width="100" height="30" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
                 <text x="300" y="139" fill="var(--text-secondary)" fontSize="12" textAnchor="middle" fontFamily="monospace">utils.ts</text>
               </svg>
            </div>
          </div>
        </div>

        <div style={{ padding: '80px 100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
           <h3 
             style={{ fontSize: '40px', fontWeight: '600', letterSpacing: '-0.03em', marginBottom: '24px', lineHeight: 1.15 }}
             className="text-gradient"
           >
             Structural code <br /> understanding.
           </h3>
           <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
             Ground generation purely in files, symbols, definitions, and dependencies. AI edits code by understanding what breaks, instead of guessing blindly.
           </p>
        </div>
      </div>
    </section>
  );
};

export default Solution;
