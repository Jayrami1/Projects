#include "mouseEvents.h"
#include <QAbstractGraphicsShapeItem>
#include <QGraphicsLineItem>

void mouseEvents::mousePressEvent(QGraphicsSceneMouseEvent *event) {
    interactionStateSaved = false;  // interactionStateSaved for move resize etc to undo redo features(doesnt map all intermediates features)
    startPoint = event->scenePos(); // Inital mouse state
    dragHandleIndex = 0;            // bounding box handle used for move resize etc

    if (activeTool == SelectTool) handleSelectionPress(event);  //Selection separately mentioned in _select
    else handleToolPress(event);        // Inside _draw
    
    if (previewItem) applyPreviewStyle();   
    QGraphicsScene::mousePressEvent(event);
}

void mouseEvents::mouseMoveEvent(QGraphicsSceneMouseEvent *event) {
    if (selectedObject && (isMoving || isResizing)) {
        handleMoveResize(event);    // Moving or resizing true uses this function of move and resize
    } else if (previewItem) {
        updatePreview(event);   // updatePreview of _Draw called
    }
    QGraphicsScene::mouseMoveEvent(event);
}

void mouseEvents::mouseReleaseEvent(QGraphicsSceneMouseEvent *event) {
    if (isMoving || isResizing) isMoving = isResizing = false;  // Finally false
    if (previewItem) {
        finalizeShape(event);   // Release event for objects
        previewItem = nullptr;  // **Very important** else if not null then preview continues and model updating continues in loop 
         sceneChanged();    // Called mainwindow to updatemodel
    }
    QGraphicsScene::mouseReleaseEvent(event);
}
void mouseEvents::saveState() {         // takes care of undo stack (works on storing entire object vector at any given instant to allow changes easily)
    if (!undo_stack || !modelVector) return;
    std::vector<std::unique_ptr<GraphicsObject>> snapshot;  // this is snapshot vector that copies each shape 
    snapshot.reserve(modelVector->size());                  // allows space efficiency by not allowing dynamic programming
    for(const auto& obj : *modelVector) {
        snapshot.push_back(obj->clone());                   // each object cloned using clone for each object
    }
    undo_stack->push(std::move(snapshot));                  
    while(!redo_stack->empty()) redo_stack->pop();          // empty redo stack if drawn something after that
}