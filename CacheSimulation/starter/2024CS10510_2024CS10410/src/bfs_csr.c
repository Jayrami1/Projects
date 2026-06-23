
#include <stdlib.h>
#include "graph.h"
#include <stdlib.h>
#include "graph.h"
// same implementation to graph just using csr row and col in instead
int bfs_csr(CSRGraph* g, int source, int* dist) {
    if (!g || !dist || source < 0 || source >= g->num_vertices) {
        return -1;
    }
    int n = g->num_vertices;
    for (int i = 0; i < n; i++) {
        dist[i] = -1;
    }

    int* queue = (int*)malloc(n * sizeof(int));
    if (!queue) return -1;

    int head = 0, tail = 0;
    int visited = 0;

    queue[tail] = source;
    tail++;
    dist[source] = 0;
    visited++;

    while (head < tail) {
        int u = queue[head];
        head++;       
        //find the start and end of node u's neighbors in the contiguous array
        int start = g->row_ptr[u];
        int end = g->row_ptr[u+1];
        //sequential memory traversal
        for (int i = start; i<end; i++) {
            int v = g->col_idx[i];
            if (dist[v] == -1) {
                dist[v] = dist[u]+1;
                queue[tail] = v;
                tail++;
                visited++;
            }
        }
    }

    free(queue);
    return visited;
}