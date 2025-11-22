import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import { ProductMetrics } from '../../types';

const ProductSentiment: React.FC = () => {
  const [data, setData] = useState<ProductMetrics | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/metrics/products`);
        setData(response.data);
      } catch (error) {
        console.error('Error fetching product metrics:', error);
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
    const margin = { top: 20, right: 20, bottom: 80, left: 60 };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Prepare data - sort by sentiment
    const products = Object.keys(data).sort((a, b) => data[b].avg_sentiment - data[a].avg_sentiment);

    // Scales
    const xScale = d3.scaleBand()
      .domain(products)
      .range([0, chartWidth])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([chartHeight, 0]);

    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(['#ef4444', '#fbbf24', '#10b981']);

    // Axes
    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '10px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px');

    // Zero line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4');

    // Bars
    g.selectAll('.bar')
      .data(products)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d)!)
      .attr('width', xScale.bandwidth())
      .attr('y', chartHeight)
      .attr('height', 0)
      .attr('fill', d => colorScale(data[d].avg_sentiment))
      .attr('rx', 4)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.7);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('opacity', 1);
      })
      .transition()
      .duration(1000)
      .attr('y', d => data[d].avg_sentiment >= 0 ? yScale(data[d].avg_sentiment) : yScale(0))
      .attr('height', d => Math.abs(yScale(data[d].avg_sentiment) - yScale(0)));

  }, [data]);

  if (!data) {
    return (
      <div>
        <div className="panel-header">
          <h2 className="panel-title">Product Sentiment</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const bestProduct = Object.entries(data).reduce((a, b) => a[1].avg_sentiment > b[1].avg_sentiment ? a : b);

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Product Sentiment Comparison</h2>
        <span className="panel-badge positive">Best: {bestProduct[0]}</span>
      </div>
      <div className="panel-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default ProductSentiment;
