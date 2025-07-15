import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import useCanvasChart from '../hooks/useCanvasChart';
import * as d3 from 'd3';

const CanvasLineChart = ({
  data = [],
  width = 800,
  height = 400,
  margin = { top: 20, right: 30, bottom: 40, left: 50 },
  lines = [],
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  animate = true,
  showPoints = false,
  strokeWidth = 2,
  className = ''
}) => {
  const tooltipRef = useRef(null);
  const hoverDataRef = useRef(null);
  
  // Références pour les échelles stables
  const scalesRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const lastDomainRef = useRef({ x: null, y: null });

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
    animate: false, // Désactiver l'animation pour éviter le scintillement
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

  // Création d'échelles stables pour éviter le scintillement
  const createStableScales = useCallback(() => {
    if (!processedData.length || !data.length) return null;

    const allValues = processedData.flatMap(line => line.data.map(d => d.value));
    const timeValues = data.map(d => d.time);

    if (!timeValues.length || !allValues.length) return null;

    // Créer des domaines stables
    const xDomain = timeValues;
    const yMin = Math.min(0, d3.min(allValues));
    const yMax = d3.max(allValues);
    const yDomain = [yMin, yMax * 1.1];

    // Vérifier si les domaines ont changé significativement
    const currentDomain = { 
      x: xDomain.join(','), 
      y: `${yDomain[0]}-${yDomain[1]}` 
    };

    // Ne recréer les échelles que si nécessaire
    if (!scalesRef.current || 
        lastDataLengthRef.current !== data.length ||
        lastDomainRef.current.x !== currentDomain.x ||
        Math.abs(parseFloat(lastDomainRef.current.y?.split('-')[1] || 0) - yDomain[1]) > yDomain[1] * 0.1) {
      
      const xScale = d3.scalePoint()
        .domain(xDomain)
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

      const yScale = d3.scaleLinear()
        .domain(yDomain)
        .range([height - margin.top - margin.bottom, 0])
        .nice();

      scalesRef.current = { x: xScale, y: yScale };
      lastDataLengthRef.current = data.length;
      lastDomainRef.current = currentDomain;
    }

    return scalesRef.current;
  }, [processedData, data, width, height, margin]);

  // Fonction de dessin principal optimisée
  const drawChart = useCallback(() => {
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

    // Dessiner les lignes
    context.save();
    context.translate(margin.left, margin.top);

    processedData.forEach((lineData, index) => {
      if (!lineData.data.length) return;

      // Filtrer les données valides
      const validData = lineData.data.filter(d => 
        d.time && !isNaN(d.value)
      );

      if (validData.length < 2) return;

      // Configuration du style
      context.strokeStyle = lineData.color;
      context.lineWidth = strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      // Dessiner la ligne avec effet de halo
      context.shadowColor = lineData.color;
      context.shadowBlur = 3;
      context.globalAlpha = 0.8;

      // Générer le chemin de la ligne
      context.beginPath();
      
      // Utiliser une courbe lisse
      const line = d3.line()
        .x(d => scales.x(d.time))
        .y(d => scales.y(d.value))
        .curve(d3.curveCardinal.tension(0.3))
        .context(context);

      line(validData);
      context.stroke();

      // Réinitialiser les effets
      context.shadowBlur = 0;
      context.globalAlpha = 1;

      // Dessiner les points si demandé
      if (showPoints) {
        context.fillStyle = lineData.color;
        validData.forEach(d => {
          const x = scales.x(d.time);
          const y = scales.y(d.value);
          
          context.beginPath();
          context.arc(x, y, 3, 0, 2 * Math.PI);
          context.fill();
          
          // Halo autour du point
          context.beginPath();
          context.arc(x, y, 6, 0, 2 * Math.PI);
          context.strokeStyle = lineData.color;
          context.lineWidth = 1;
          context.globalAlpha = 0.3;
          context.stroke();
          context.globalAlpha = 1;
        });
      }
    });

    context.restore();
  }, [setupCanvas, processedData, width, height, margin, drawGrid, drawAxes, strokeWidth, showPoints, createStableScales]);

  // Gestion du survol pour les tooltips
  const handleMouseMove = useCallback((event) => {
    if (!canvasRef.current || !processedData.length || !scalesRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - margin.left;

    // Trouver le point le plus proche
    const timeValues = data.map(d => d.time);
    const xScale = scalesRef.current.x;

    const bisector = d3.bisector(d => d.time).left;
    const timeValue = xScale.invert(x); // Utilisez l'inversion de l'échelle si possible
    const index = bisector(data, timeValue, 1);

    const d0 = data[index - 1];
    const d1 = data[index];
    const closestTimeIndex = (d1 && timeValue - d0.time > d1.time - timeValue) ? index : index -1;
    const closestTime = timeValues[closestTimeIndex];

    if (closestTime && tooltipRef.current) {
      const tooltipData = processedData.map(line => ({
        name: line.name,
        value: data[closestTimeIndex]?.[line.key] || 0,
        color: line.color
      }));

      hoverDataRef.current = { time: closestTime, data: tooltipData, x: event.clientX, y: event.clientY };
      
      // Afficher le tooltip (implémentation basique)
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

  // Effet pour redessiner quand les données changent (sans animation)
  useEffect(() => {
    if (processedData.length > 0) {
      // Utiliser requestAnimationFrame pour un rendu fluide
      const rafId = requestAnimationFrame(drawChart);
      return () => cancelAnimationFrame(rafId);
    }
  }, [processedData, drawChart]);

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