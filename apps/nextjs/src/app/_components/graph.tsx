"use client";

import { useEffect, useMemo, useState } from "react";
import ForceGraph from "react-force-graph-3d";

import { Button } from "@senka/ui/button";

import { api } from "~/trpc/react";

interface Link {
  source: string;
  target: string;
  type: string;
}

interface Node {
  id: string;
  name: string;
  type: string;
  neighbors?: Node[];
  links?: Link[];
}

export function Graph() {
  const [{ links, nodes }] = api.user.graph.useSuspenseQuery();

  const [highlightNodes, setHighlightNodes] = useState<Set<Node>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<Link>>(new Set());
  const [activeNode, setActiveNode] = useState<Node | null>(null);

  const graphData = useMemo(() => {
    const data = {
      nodes: nodes,
      links: links,
    };

    // Add neighbor and link references to nodes
    data.links.forEach((link) => {
      const source = data.nodes.find((n) => n.id === link.source) as Node;
      const target = data.nodes.find((n) => n.id === link.target) as Node;

      if (!source || !target) return;

      // Initialize neighbors arrays
      if (!source.neighbors) source.neighbors = [];
      if (!target.neighbors) target.neighbors = [];
      source.neighbors.push(target);
      target.neighbors.push(source);

      // Initialize links arrays
      if (!source.links) source.links = [];
      if (!target.links) target.links = [];
      source.links.push(link);
      target.links.push(link);
    });

    return data;
  }, [nodes, links]);

  const invalidateGraph = () => {
    const utils = api.useUtils();
    void utils.user.graph.invalidate();
  };

  const getNodeColor = (node: Node) => {
    if (!highlightNodes.size) {
      switch (node.type) {
        case "user":
          return "#ff6b6b";
        case "post":
          return "#4ecdc4";
        case "domain":
          return "#45b7d1";
        default:
          return "#666";
      }
    }

    return highlightNodes.has(node)
      ? "#FFD700" // Highlight color
      : "#666666"; // Dim color for non-highlighted nodes
  };

  const getLinkColor = (link: Link) => {
    if (!highlightLinks.size) {
      switch (link.type) {
        case "follows":
          return "#ff9f43";
        case "posted":
          return "#4ecdc4";
        case "links_to":
          return "#45b7d1";
        default:
          return "#666";
      }
    }

    return highlightLinks.has(link)
      ? "#FFD700" // Highlight color
      : "#666666"; // Dim color for non-highlighted links
  };

  const handleNodeClick = (node: Node | null) => {
    const newHighlightNodes = new Set<Node>();
    const newHighlightLinks = new Set<Link>();

    if (node) {
      newHighlightNodes.add(node);
      node.neighbors?.forEach((neighbor) => newHighlightNodes.add(neighbor));
      node.links?.forEach((link) => newHighlightLinks.add(link));
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
    setActiveNode(node);
  };

  const handleLinkHover = (link: Link | null) => {
    const newHighlightNodes = new Set<Node>();
    const newHighlightLinks = new Set<Link>();

    if (link) {
      newHighlightLinks.add(link);
      // Find the actual node objects from the graph data
      const sourceNode = graphData.nodes.find(
        (n) => n.id === link.source,
      ) as Node;
      const targetNode = graphData.nodes.find(
        (n) => n.id === link.target,
      ) as Node;
      if (sourceNode) newHighlightNodes.add(sourceNode);
      if (targetNode) newHighlightNodes.add(targetNode);
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  };

  return (
    <>
      <div className="absolute left-0 top-0">
        <Button onClick={invalidateGraph}>Refetch</Button>
      </div>
      <ForceGraph
        graphData={graphData}
        // enableNodeDrag={false}
        nodeId="id"
        nodeLabel="name"
        nodeVal={(node) => node.val}
        nodeColor={getNodeColor}
        onNodeClick={handleNodeClick}
        linkSource="source"
        linkTarget="target"
        linkLabel="name"
        linkColor={getLinkColor}
        onLinkHover={handleLinkHover}
        linkWidth={(link) => (highlightLinks.has(link) ? 2 : 1)}
        // nodeAutoColorBy="group"

        linkDirectionalArrowLength={3} // Arrow size
        linkDirectionalArrowRelPos={1} // Arrow position along line
        linkCurvature={0.2} // Add curve to better show bidirectional links
      />
    </>
  );
}
