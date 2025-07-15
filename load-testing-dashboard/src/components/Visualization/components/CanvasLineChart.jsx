import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import useCanvasChart from '../hooks/useCanvasChart';
import * as d3 from 'd3';

const CanvasLineChart = ({
  data = [],
  width = 1200,
  height = 350,
  margin = { top: 20, right: 50, bottom: 40, left: 60 },
  lines = [],
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  animate = true,
  showPoints = false,
  strokeWidth = 2,
  className = '',
  useFixedScale = true
}) => {
  const tooltipRef = useRef(null);
  const hoverDataRef = useRef(null);
  
  // Références pour les échelles stables et repères fixes
  const scalesRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const lastDomainRef = useRef({ x: null, y: null });
  const fixedDomainRef = useRef({ x: null, y: null });

  const {
    canvasRef,
    setupCanvas,
    createScales,
    drawGrid,
    drawAxes,
    createLineGenerator,
    animateChart
  } = useCanvasChart({
    data,
    width,
    height,
    margin,
    animate: false,
    smoothCurve: true
  });

  // Préparation des données pour les lignes multiples
  const processedData = useMemo(() => {
    if (!data.length || !lines.length) return [];

    return lines.map((line, index) => ({
      key: line.dataKey,
      name: line.name || line.dataKey,
      color: line.color || colors[index % colors.length],
      data: data.map(d => ({
        time: d.time,
        value: d[line.dataKey] || 0
      })).filter(d => d.value != null && !isNaN(d.value))
    }));
  }, [data, lines, colors]);

  // Création d'échelles stables avec repères fixes pour éviter le scintillement
  const createStableScales = useCallback(() => {
    if (!processedData.length || !data.length) return null;

    // Filtrer les valeurs aberrantes pour des échelles plus stables
    const allValues = processedData.flatMap(line => 
      line.data.map(d => d.value).filter(v => v != null && isFinite(v) && v >= 0)
    );
    const timeValues = data.map(d => d.time);

    if (!timeValues.length || !allValues.length) return null;

    // Créer des domaines avec repères fixes si activé
    const xDomain = timeValues;
    const yMin = Math.max(0, d3.min(allValues) * 0.95); // Éviter les valeurs négatives
    const yMax = d3.max(allValues);
    
    let finalYDomain;
    if (useFixedScale && fixedDomainRef.current.y) {
      // Utiliser le domaine fixe existant, mais l'étendre si nécessaire
      const [currentMin, currentMax] = fixedDomainRef.current.y;
      
      // Éviter les changements trop fréquents d'échelle (seuil de 20%)
      const shouldUpdateMax = yMax > currentMax * 1.2;
      const shouldUpdateMin = yMin < currentMin * 0.8;
      
      finalYDomain = [
        shouldUpdateMin ? yMin : currentMin,
        shouldUpdateMax ? yMax * 1.1 : currentMax
      ];
    } else {
      finalYDomain = [yMin, yMax * 1.1];
    }

    // Sauvegarder le domaine fixe
    if (useFixedScale) {
      fixedDomainRef.current.y = finalYDomain;
    }

    // Vérifier si les domaines ont changé significativement
    const currentDomain = { 
      x: xDomain.join(','), 
      y: `${finalYDomain[0]}-${finalYDomain[1]}` 
    };

    // Ne recréer les échelles que si nécessaire
    if (!scalesRef.current || 
        lastDataLengthRef.current !== data.length ||
        lastDomainRef.current.x !== currentDomain.x ||
        (!useFixedScale && Math.abs(parseFloat(lastDomainRef.current.y?.split('-')[1] || 0) - finalYDomain[1]) > finalYDomain[1] * 0.2)) {
      
      const xScale = d3.scalePoint()
        .domain(xDomain)
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

      const yScale = d3.scaleLinear()
        .domain(finalYDomain)
        .range([height - margin.top - margin.bottom, 0])
        .nice();

      scalesRef.current = { x: xScale, y: yScale };
      lastDataLengthRef.current = data.length;
      lastDomainRef.current = currentDomain;
    }

    return scalesRef.current;
  }, [processedData, data, width, height, margin, useFixedScale]);

  // Fonction de dessin principal optimisée avec animations fluides
  const drawChart = useCallback((progress = 1) => {
    const context = setupCanvas();
    if (!context || !processedData.length) return;

    const scales = createStableScales();
    if (!scales) return;

    // Effacer le canvas
    context.clearRect(0, 0, width, height);

    // Dessiner la grille avec les échelles stables
    drawGrid(context, scales);

    // Dessiner les axes avec les échelles stables
    drawAxes(context, scales);

    // Dessiner les lignes avec animation
    context.save();
    context.translate(margin.left, margin.top);

    processedData.forEach((lineData, index) => {
      if (!lineData.data.length) return;

      // Filtrer les données valides
      const validData = lineData.data.filter(d => 
        d.time && !isNaN(d.value)
      );

      if (validData.length < 2) return;

      // Animation : limiter les données affichées selon le progrès
      const animatedData = animate ? 
        validData.slice(0, Math.ceil(validData.length * progress)) : 
        validData;

      if (animatedData.length < 2) return;

      // Configuration du style avec effet de halo réduit pour éviter le scintillement
      context.strokeStyle = lineData.color;
      context.lineWidth = strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      // Dessiner la ligne avec effet de halo subtil
      context.shadowColor = lineData.color;
      context.shadowBlur = animate ? 2 : 1;
      context.globalAlpha = 0.9;

      // Générer le chemin de la ligne
      context.beginPath();
      
      // Utiliser une courbe lisse
      const line = d3.line()
        .x(d => scales.x(d.time))
        .y(d => scales.y(d.value))
        .curve(d3.curveCardinal.tension(0.2))
        .context(context);

      line(animatedData);
      context.stroke();

      // Réinitialiser les effets
      context.shadowBlur = 0;
      context.globalAlpha = 1;

      // Dessiner les points si demandé
      if (showPoints) {
        context.fillStyle = lineData.color;
        animatedData.forEach((d, pointIndex) => {
          // Animation des points
          const pointProgress = animate ? 
            Math.max(0, Math.min(1, (progress * animatedData.length - pointIndex) / 1)) : 1;
          
          if (pointProgress > 0) {
            const x = scales.x(d.time);
            const y = scales.y(d.value);
            const radius = 3 * pointProgress;
            
            context.beginPath();
            context.arc(x, y, radius, 0, 2 * Math.PI);
            context.fill();
            
            // Halo autour du point (réduit)
            context.beginPath();
            context.arc(x, y, radius + 2, 0, 2 * Math.PI);
            context.strokeStyle = lineData.color;
            context.lineWidth = 1;
            context.globalAlpha = 0.2 * pointProgress;
            context.stroke();
            context.globalAlpha = 1;
          }
        });
      }
    });

    context.restore();
  }, [setupCanvas, processedData, width, height, margin, drawGrid, drawAxes, strokeWidth, showPoints, createStableScales, animate]);

  // Gestion du survol pour les tooltips
  const handleMouseMove = useCallback((event) => {
    if (!canvasRef.current || !processedData.length || !scalesRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - margin.left;

    // Trouver le point le plus proche
    const timeValues = data.map(d => d.time);
    const xScale = scalesRef.current.x;

    // Find the closest point without using invert
    let closestTimeIndex = 0;
    let minDistance = Infinity;

    const domain = xScale.domain();
    domain.forEach((d, i) => {
      const distance = Math.abs(xScale(d) - x);
      if (distance < minDistance) {
        minDistance = distance;
        closestTimeIndex = i;
      }
    });
    const closestTime = timeValues[closestTimeIndex];

    if (closestTime && tooltipRef.current) {
      const tooltipData = processedData.map(line => ({
        name: line.name,
        value: data[closestTimeIndex]?.[line.key] || 0,
        color: line.color
      }));

      hoverDataRef.current = { time: closestTime, data: tooltipData, x: event.clientX, y: event.clientY };
      
      // Afficher le tooltip
      tooltipRef.current.style.display = 'block';
      tooltipRef.current.style.left = `${event.clientX + 10}px`;
      tooltipRef.current.style.top = `${event.clientY - 10}px`;
      tooltipRef.current.innerHTML = `
        <div class="bg-white p-2 border border-gray-200 rounded shadow-lg text-sm">
          <div class="font-medium">${closestTime}</div>
          ${tooltipData.map(item => `
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${item.color}"></div>
              <span>${item.name}: ${typeof item.value === 'number' ? item.value.toFixed(2) : item.value}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
  }, [canvasRef, processedData, data, margin]);

  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
    hoverDataRef.current = null;
  }, []);

  // Effet pour redessiner avec animation fluide
  useEffect(() => {
    if (processedData.length > 0) {
      if (animate) {
        animateChart(drawChart);
      } else {
        const rafId = requestAnimationFrame(() => drawChart(1));
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [processedData, drawChart, animate, animateChart]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
        style={{ width, height }}
      />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none z-50"
        style={{ display: 'none' }}
      />
      
      {/* Légende */}
      {processedData.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          {processedData.map((line, index) => (
            <div key={line.key} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              <span className="text-gray-700">{line.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CanvasLineChart;