
#include <stdlib.h>
#include "graph.h"
int bfs_pointer(Graph* g, int source, int* dist) { 
    if(!g || !dist || source<0 || source >= g->num_vertices){
        return -1;
    }
    int n = g->num_vertices;
    
    //initialize all distances to -1
    for (int i = 0; i < n; i++) {
        dist[i] = -1;
    }
    // queue array allocation
    int* queue = (int*)malloc(n * sizeof(int));
    if (!queue) return -1;
    int head = 0, tail = 0;
    int visited = 0;
    queue[tail] = source;
    tail++;
    dist[source] = 0;
    visited++;
    //BFS
    while (head < tail) {
        int u = queue[head];
        head++;
        //traverse the linked list of neighbors 
        for (Edge* e = g->vertices[u].head; e != NULL; e = e->next) {
            int v = e->dst;
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue[tail] = v;
                tail++;
                visited++;
            }
        }
    }
    free(queue);// free up memory held by queue
    return visited; // return visited count
}
