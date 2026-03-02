#include "mouseEvents.h"

void mouseEvents::handleSelectionPress(QGraphicsSceneMouseEvent *event) {
    if (selectedObject) {
         
        QRectF b = selectedObject->getBounds();// get the box around the shape
        QRectF handle(0, 0, 10, 10); // create a virtual 8x8 pixel hit box
        // Functor definiton for easier changes common to all
        auto check = [&](QPointF p) { handle.moveCenter(p); return handle.contains(event->scenePos()); }; // Shifts each handle to bounding box points
        if (check(b.topLeft())) dragHandleIndex = 1;            //naming 1 2 4 3 colckwise from top-left
        else if (check(b.topRight())) dragHandleIndex = 2;
        else if (check(b.bottomLeft())) dragHandleIndex = 3;
        else if (check(b.bottomRight())) dragHandleIndex = 4;
        if (dragHandleIndex != 0) {
            isResizing = true;      // non-zero means resizing
            return;
        }
    }
    selectedObject = nullptr; // empty space clicking means non selecting
      // if for any object my mouse is inside that object i am moving it 
    for (auto it = modelVector->rbegin(); it != modelVector->rend(); ++it) {    // reference iteration to prevent copies and since modelVector is reference vector
        if ((*it)->contains(event->scenePos())) {
            selectedObject = it->get();
            isMoving = true;
            break;
        }
    }
    sceneChanged();
}
void mouseEvents::handleMoveResize(QGraphicsSceneMouseEvent *event) {
    double dx = event->scenePos().x() - startPoint.x();     // dx dy based on how much my mouse is moved
    double dy = event->scenePos().y() - startPoint.y();
    if ((isResizing || isMoving) && !interactionStateSaved && selectedObject) {
        saveState(); 
        interactionStateSaved = true;      // saved stated in undo stack after releasing 
    }
    if (isResizing) {   // width and height changes based on coordinate system location
        if (dragHandleIndex == 1) { selectedObject->move(dx, dy); selectedObject->resize(-dx, -dy); } // moves x y and chages width and height
        else if (dragHandleIndex == 2) { selectedObject->move(0, dy); selectedObject->resize(dx, -dy); } //moves y but not x changes width and height
        else if (dragHandleIndex == 3) { selectedObject->move(dx, 0); selectedObject->resize(-dx, dy); }    //moves x but not y changes width and height
        else if (dragHandleIndex == 4) { selectedObject->resize(dx, dy); }  //none moves but width and height changes
    } else if (isMoving) {
        selectedObject->move(dx, dy);   // If moving then simple
    }
    startPoint = event->scenePos();     //updating startpoint on new position
    sceneChanged();
}