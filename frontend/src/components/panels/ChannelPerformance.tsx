import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import { ChannelMetrics } from '../../types';

const ChannelPerformance: React.FC = () => {
  const [data, setData] = useState<ChannelMetrics | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/metrics/channels`);
        setData(response.data);
      } catch (error) {
        console.error('Error fetching channel metrics:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 120, bottom: 40, left: 60 };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Prepare data
    const channels = Object.keys(data);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(channels, d => data[d].count) || 100])
      .range([0, chartWidth]);

    const yScale = d3.scaleBand()
      .domain(channels)
      .range([0, chartHeight])
      .padding(0.3);

    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(['#ef4444', '#fbbf24', '#10b981']);

    // Axes
    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px');

    // Bars
    g.selectAll('.bar')
      .data(channels)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => yScale(d)!)
      .attr('width', 0)
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(data[d].avg_sentiment))
      .attr('rx', 4)
      .transition()
      .duration(1000)
      .attr('width', d => xScale(data[d].count));

    // Count labels
    g.selectAll('.label')
      .data(channels)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => xScale(data[d].count) + 5)
      .attr('y', d => yScale(d)! + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px')
      .text(d => `${data[d].count} (${data[d].avg_sentiment.toFixed(2)})`);

  }, [data]);

  if (!data) {
    return (
      <div>
        <div className="panel-header">
          <h2 className="panel-title">Channel Performance</h2>
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
        <h2 className="panel-title">Channel Performance</h2>
      </div>
      <div className="panel-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default ChannelPerformance;
