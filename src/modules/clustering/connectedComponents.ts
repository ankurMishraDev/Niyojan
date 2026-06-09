export class Graph {
  private adjacencyList: Map<string, string[]> = new Map();

  addVertex(v: string) {
    if (!this.adjacencyList.has(v)) {
      this.adjacencyList.set(v, []);
    }
  }

  addEdge(v: string, w: string) {
    this.adjacencyList.get(v)?.push(w);
    this.adjacencyList.get(w)?.push(v); // Assuming undirected graph
  }

  getConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const [vertex] of this.adjacencyList.entries()) {
      if (!visited.has(vertex)) {
        const component: string[] = [];
        this.dfs(vertex, visited, component);
        components.push(component);
      }
    }

    return components;
  }

  private dfs(vertex: string, visited: Set<string>, component: string[]) {
    visited.add(vertex);
    component.push(vertex);

    const neighbors = this.adjacencyList.get(vertex) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.dfs(neighbor, visited, component);
      }
    }
  }
}
