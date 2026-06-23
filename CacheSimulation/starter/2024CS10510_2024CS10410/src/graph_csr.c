
#include <stdlib.h>
#include "graph.h"
#include <stdlib.h>
#include "graph.h"

CSRGraph* convert_to_csr(Graph* g) {
    if (!g) return NULL;

    CSRGraph* csr = (CSRGraph*)malloc(sizeof(CSRGraph));
    if (!csr) return NULL;

    csr->num_vertices = g->num_vertices;

    // giving the number of edeges to csr graph
    int num_edges = 0;
    for (int i = 0; i < g->num_vertices; i++) {
        for (Edge* e = g->vertices[i].head; e != NULL; e = e->next) {
            num_edges++;
        }
    }
    csr->num_edges = num_edges;
    // reserving space in contiguous arrays for colid or neightbours and row id or vertex
    csr->row_ptr = (int*)malloc((g->num_vertices + 1) * sizeof(int));
    csr->col_idx = (int*)malloc(num_edges * sizeof(int));
    // importatnt edge case
    if (!csr->row_ptr || (!csr->col_idx && num_edges > 0)) {
        free(csr->row_ptr);
        free(csr->col_idx);
        free(csr);
        return NULL;
    }

    // convert the graph to csr  by adding edges to row and neighbours to col
    int current_edge = 0;
    for (int i = 0; i < g->num_vertices; i++) {
        csr->row_ptr[i] = current_edge;
        for (Edge* e = g->vertices[i].head; e != NULL; e = e->next) {
            csr->col_idx[current_edge++] = e->dst;
        }
    }
    
    //the final entry in row bounds the last vertexs neighbors
    csr->row_ptr[g->num_vertices] = current_edge;
    return csr;
}
// destructor of sorts
void free_csr(CSRGraph* g) {
    if (!g) return;
    free(g->row_ptr);
    free(g->col_idx);
    free(g);
}
