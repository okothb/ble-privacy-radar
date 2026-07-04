import React, { useEffect, useRef } from 'react';

const RadarScreen = ({ devices = {} }) => {
  const canvasRef = useRef(null);
  const visualStatesRef = useRef({}); // Stores fading/glow states for each active address

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let sweepAngle = 0;

    const render = () => {
      // Clear canvas with a deep, dark space background
      ctx.fillStyle = '#02050a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) - 20;

      // 1. Draw Cyber Hexagonal / Square Grid Overlay
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Draw Compass Bearings (Radial Lines every 30 degrees)
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.05)';
      ctx.lineWidth = 1;
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + maxRadius * Math.cos(rad), centerY + maxRadius * Math.sin(rad));
        ctx.stroke();
      }

      // 3. Draw Concentric Range Rings (5m, 15m, 30m, 50m boundaries)
      // We map these non-linearly to provide higher visual resolution at close ranges
      // Scales: 5m -> 0.2, 15m -> 0.45, 30m -> 0.75, 50m+ -> 1.0
      const ringScales = [0.2, 0.45, 0.75, 1.0];
      const ringLabels = ['5m', '15m', '30m', '50m+'];

      ringScales.forEach((scale, index) => {
        // Draw glow ring
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * scale, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(20, 184, 166, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * scale + 2, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw distance tag label text
        ctx.fillStyle = 'rgba(20, 184, 166, 0.35)';
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillText(ringLabels[index], centerX + 8, centerY - (maxRadius * scale) + 11);
      });

      // 4. Draw Crosshair Central Axes
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, 15); ctx.lineTo(centerX, canvas.height - 15);
      ctx.moveTo(15, centerY); ctx.lineTo(canvas.width - 15, centerY);
      ctx.stroke();

      // 5. Draw Dynamic Sweeper Line with Trailing Gradient Sector
      sweepAngle = (sweepAngle + 0.012) % (2 * Math.PI);

      // Draw sweeping wedge (trailing fade sectors)
      const wedgeTailLength = 40; // Number of steps in the tail fade
      for (let i = 0; i < wedgeTailLength; i++) {
        const angleOffset = sweepAngle - (i * 0.008);
        const opacity = (1.0 - (i / wedgeTailLength)) * 0.18; // Fade tail opacity
        ctx.strokeStyle = `rgba(13, 148, 136, ${opacity})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + maxRadius * Math.cos(angleOffset),
          centerY + maxRadius * Math.sin(angleOffset)
        );
        ctx.stroke();
      }

      // Draw the bright leading edge sweeper line
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + maxRadius * Math.cos(sweepAngle),
        centerY + maxRadius * Math.sin(sweepAngle)
      );
      ctx.stroke();

      // 6. Map and Render Target Device Nodes
      Object.values(devices).forEach((device) => {
        if (!device.distance || device.distance === 'N/A') return; // Filter dormant items

        const targetDistance = parseFloat(device.distance);
        
        // Piecewise mapping of distances to concentric ring scales for precise alignment
        let radiusScale = 1.0;
        if (targetDistance <= 5) {
          radiusScale = (targetDistance / 5) * 0.2;
        } else if (targetDistance <= 15) {
          radiusScale = 0.2 + ((targetDistance - 5) / 10) * 0.25; // 0.2 to 0.45
        } else if (targetDistance <= 30) {
          radiusScale = 0.45 + ((targetDistance - 15) / 15) * 0.3; // 0.45 to 0.75
        } else {
          radiusScale = 0.75 + Math.min((targetDistance - 30) / 40, 1.0) * 0.25; // 0.75 to 1.0
        }

        const calculatedRadius = maxRadius * radiusScale;

        // Generate consistent bearing using the MAC address
        const seed = device.address.split(':').reduce((acc, byte) => acc + parseInt(byte, 16), 0);
        const constantBearing = (seed % 360) * (Math.PI / 180);

        const nodeX = centerX + calculatedRadius * Math.cos(constantBearing);
        const nodeY = centerY + calculatedRadius * Math.sin(constantBearing);

        // Fetch or initialize visual decay state for this node
        if (!visualStatesRef.current[device.address]) {
          visualStatesRef.current[device.address] = { opacity: 0.2, lastSweepAngle: sweepAngle };
        }
        
        const state = visualStatesRef.current[device.address];

        // Check if leading sweep line passed through target bearing
        // Bearing normalized difference
        const angleDiff = Math.abs(sweepAngle - constantBearing);
        const isSwept = angleDiff < 0.05 || (angleDiff > 2 * Math.PI - 0.05);

        if (isSwept) {
          state.opacity = 1.0; // Instantly flash to peak brightness
        } else {
          // Slow visual decay
          state.opacity = Math.max(0.22, state.opacity - 0.005);
        }

        // Color configurations based on risk profile
        let nodeColor = 'rgba(56, 189, 248, '; // Static TV/Infrastructure (Sky blue)
        if (device.type === 'RPA (Target)') {
          nodeColor = device.threatScore > 75 
            ? 'rgba(239, 68, 68, '  // Verified tail (Crimson red)
            : 'rgba(251, 191, 36, '; // Unverified target warning (Amber)
        }

        const drawColor = `${nodeColor}${state.opacity})`;
        const glowColor = `${nodeColor}${state.opacity * 0.65})`;

        // Draw node glow shadow
        ctx.fillStyle = drawColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12 * state.opacity;

        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Draw inner high-intensity core
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0; // Reset shadow for inner core
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw distance text tooltip if hover/highly threatened
        if (device.threatScore > 75 && state.opacity > 0.4) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.font = '8px "Share Tech Mono", monospace';
          ctx.fillText(`TAIL: ${device.distance}m`, nodeX + 8, nodeY + 3);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [devices]);

  return (
    <div className="flex flex-col items-center justify-center p-5 cyber-card rounded-xl">
      <div className="flex items-center space-x-1.5 mb-3 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
        <h3 className="text-xs font-bold tracking-widest text-teal-400 uppercase">Ambient RF Radar Mesh</h3>
      </div>
      <canvas 
        ref={canvasRef} 
        width={340} 
        height={340} 
        className="rounded-full bg-[#02050a] border border-teal-900/30 shadow-inner shadow-teal-950/20" 
      />
    </div>
  );
};

export default RadarScreen;