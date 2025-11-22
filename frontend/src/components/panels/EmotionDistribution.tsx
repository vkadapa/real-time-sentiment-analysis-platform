import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AggregatedMetrics } from '../../types';

interface Props {
  metrics: AggregatedMetrics | null;
}

const EmotionDistribution: React.FC<Props> = ({ metrics }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!metrics || !metrics.emotion_distribution || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 40;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Prepare data
    const emotions = Object.entries(metrics.emotion_distribution)
      .map(([emotion, count]) => ({ emotion, count }))
      .filter(d => d.count > 0);

    if (emotions.length === 0) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('fill', '#9ca3af')
        .text('No emotion data');
      return;
    }

    // Color scale
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['anger', 'joy', 'sadness', 'fear', 'surprise', 'love', 'neutral', 'disgust'])
      .range(['#ef4444', '#fbbf24', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#6b7280', '#fb923c']);

    // Pie generator
    const pie = d3.pie<any>()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.5)
      .outerRadius(radius);

    const labelArc = d3.arc()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);

    // Draw arcs
    const arcs = g.selectAll('.arc')
      .data(pie(emotions))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc as any)
      .attr('fill', d => colorScale(d.data.emotion))
      .attr('stroke', '#1e2330')
      .attr('stroke-width', 2)
      .style('opacity', 0)
      .on('mouseover', function() {
        d3.select(this).style('opacity', 0.8);
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 1);
      })
      .transition()
      .duration(1000)
      .style('opacity', 1)
      .attrTween('d', function(d: any) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t: number) {
          return (arc as any)(interpolate(t));
        };
      });

    // Labels
    arcs.append('text')
      .attr('transform', d => `translate(${(labelArc as any).centroid(d)})`)
      .attr('text-anchor', 'middle')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => d.data.count);

    // Legend
    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - 120}, 20)`);

    emotions.forEach((emotion, i) => {
      const legendRow = legend
        .append('g')
        .attr('transform', `translate(0, ${i * 25})`);

      legendRow
        .append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colorScale(emotion.emotion))
        .attr('rx', 3);

      legendRow
        .append('text')
        .attr('x', 20)
        .attr('y', 12)
        .style('fill', '#e7e9ea')
        .style('font-size', '12px')
        .text(emotion.emotion);
    });

  }, [metrics]);

  if (!metrics || !metrics.emotion_distribution) {
    return (
      <div>
        <div className="panel-header">
          <h2 className="panel-title">Emotion Distribution</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Emotion Distribution</h2>
      </div>
      <div className="panel-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default EmotionDistribution;
