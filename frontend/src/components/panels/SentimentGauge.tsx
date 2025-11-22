import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AggregatedMetrics } from '../../types';

interface Props {
  metrics: AggregatedMetrics | null;
}

const SentimentGauge: React.FC<Props> = ({ metrics }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!metrics || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 20;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2 + 20})`);

    // Arc generator
    const arc = d3.arc()
      .innerRadius(radius - 30)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2);

    // Background arc
    g.append('path')
      .datum({ endAngle: Math.PI / 2 })
      .style('fill', '#2d3748')
      .attr('d', arc as any);

    // Color scale
    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(['#ef4444', '#fbbf24', '#10b981']);

    // Value arc
    const sentimentScore = metrics.avg_sentiment;
    const angle = (sentimentScore + 1) * (Math.PI / 2) - Math.PI / 2;

    g.append('path')
      .datum({ endAngle: angle })
      .style('fill', colorScale(sentimentScore))
      .attr('d', arc as any)
      .transition()
      .duration(1000)
      .attrTween('d', function (d: any) {
        const interpolate = d3.interpolate(-Math.PI / 2, d.endAngle);
        return function (t: number) {
          d.endAngle = interpolate(t);
          return (arc as any)(d);
        };
      });

    // Center text - sentiment score
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .style('font-size', '36px')
      .style('font-weight', 'bold')
      .style('fill', colorScale(sentimentScore))
      .text(sentimentScore.toFixed(2));

    // Label
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .style('font-size', '14px')
      .style('fill', '#9ca3af')
      .text('Average Sentiment');

    // Stats
    const stats = [
      { label: 'Positive', value: metrics.positive_count, color: '#10b981' },
      { label: 'Neutral', value: metrics.neutral_count, color: '#fbbf24' },
      { label: 'Negative', value: metrics.negative_count, color: '#ef4444' }
    ];

    const statsG = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height - 40})`);

    stats.forEach((stat, i) => {
      const x = (i - 1) * 120;
      const statG = statsG.append('g').attr('transform', `translate(${x}, 0)`);

      statG
        .append('text')
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('font-weight', 'bold')
        .style('fill', stat.color)
        .text(stat.value);

      statG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.5em')
        .style('font-size', '12px')
        .style('fill', '#9ca3af')
        .text(stat.label);
    });

  }, [metrics]);

  if (!metrics) {
    return (
      <div>
        <div className="panel-header">
          <h2 className="panel-title">Overall Sentiment</h2>
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
        <h2 className="panel-title">Overall Sentiment</h2>
        <span className="panel-badge neutral">{metrics.count} messages</span>
      </div>
      <div className="panel-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default SentimentGauge;
