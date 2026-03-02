#include "mouseEvents.h"
#include "Rectangle.h"
#include "Circle.h"
#include "line.h"
#include "Hexagon.h"
#include "FreeHand.h"
#include "Text.h"
#include <QGraphicsPathItem>
#include <QInputDialog>
#include <cmath>
void mouseEvents::handleToolPress(QGraphicsSceneMouseEvent *event) { // Press Event that starts object drawing
    if (activeTool == TextTool) {bool ok; //Text wriiten or not bool
        QGraphicsRectItem* cursor = addRect(startPoint.x(),startPoint.y(),5,curr_fs,QPen(Qt::black),QBrush(Qt::black)); // To make where changes are made visible
        QString txt = QInputDialog::getText(nullptr, "Text Tool", "Enter text:", QLineEdit::Normal, "", &ok);   // Input Text Dialog module
        removeItem(cursor);     // Unlinks from scene and gives ownership back here so that nothing crashes
        delete cursor;          // Deleting to prevent memory leaks
        if (ok && !txt.isEmpty()) {         
            saveState();    // Function to update undo and redo stacks accordingly 
            auto t = std::make_unique<Text>();      // Unique_ptr obj
            t->x = startPoint.x();t->y = startPoint.y();t->content = txt.toStdString();     // Parameters updated
            t->font_size = curr_fs;t->font_family = curr_ff.toStdString();t->fill_Color = currentFill;
            modelVector->push_back(std::move(t));   // ModelVector is actually storing the objects for undo stack apparently 
            sceneChanged(); // Signal to say hey window update the model 
        }return;
    }else if (activeTool == RectTool) { // makes a preview item visible to scene (Includes rounded logic too)
        QPainterPath p; p.addRoundedRect(QRectF(startPoint, QSizeF(0, 0)), curr_r,curr_r);previewItem = addPath(p);
    }else if (activeTool ==CircleTool) previewItem = addEllipse(startPoint.x(), startPoint.y(), 0, 0); // Circle is eventually an ellipse
    else if (activeTool==LineTool) previewItem = addLine(QLineF(startPoint, startPoint)); // Line previewitem
    else if (activeTool ==HexagonTool) previewItem = addPolygon(QPolygonF());// Polygon preview item
    else if (activeTool ==FreeTool) { 
        startPoint = event->scenePos();     // Requires current position of mouse to start path position
        QPainterPath path;                  // moveTo and lineTo are used to do repectively at given points
        path.moveTo(startPoint);path.lineTo(startPoint);previewItem = addPath(path);        // Path added as preview item
    }
}void mouseEvents::updatePreview(QGraphicsSceneMouseEvent *event) {     // Updating preview as mouse moves
    if (activeTool == RectTool) { // Dynamic_cast casts to given type if not then nullptr
        if (auto p = dynamic_cast<QGraphicsPathItem*>(previewItem)) {       // To path item and not rectitem to allow rounded rect
            QPainterPath path; path.addRoundedRect(QRectF(startPoint, event->scenePos()).normalized(), curr_r, curr_r);
            p->setPath(path);       // From startPoint x,y to moved x,y while keeping positive width and height , radius into consideration
        }
    } else if (activeTool == CircleTool) {
        double r = QLineF(startPoint, event->scenePos()).length();      // for radius of circle
        if (auto c = dynamic_cast<QGraphicsEllipseItem*>(previewItem)) c->setRect(startPoint.x()-r, startPoint.y()-r, r*2, r*2);    // initial point tells us centre
    } else if (activeTool == LineTool) {    // Initial as start point and final point is final mouse posi
        if (auto l = dynamic_cast<QGraphicsLineItem*>(previewItem)) l->setLine(QLineF(startPoint, event->scenePos()));
    } else if (activeTool == HexagonTool) {
        if (auto p = dynamic_cast<QGraphicsPolygonItem*>(previewItem)) {    // Polygon points for hexagon
            double r = QLineF(startPoint, event->scenePos()).length();
            double a = std::atan2(event->scenePos().y()-startPoint.y(), event->scenePos().x()-startPoint.x());  // atan2 is arctan in all coordinates for rotation
            QPolygonF poly; // angle by y/x also calculates all points
            for (int i=0; i<6; i++) poly << QPointF(startPoint.x() + r*cos(a+i*M_PI/3), startPoint.y() + r*sin(a+i*M_PI/3));
            p->setPolygon(poly);
        }
    } else if (activeTool == FreeTool) {
        if (auto p = dynamic_cast<QGraphicsPathItem*>(previewItem)) {
            QPainterPath path = p->path();  // to make sure no path from scene origin is drawn when empty
            if (path.elementCount() == 0) {path.moveTo(startPoint);} path.lineTo(event->scenePos());p->setPath(path);
        }
    }
}void mouseEvents::finalizeShape(QGraphicsSceneMouseEvent *e) { // Somewhat mouse release state
    saveState();// All doing same, creating objects, updating its paramters and moving it to obj (std::move transfers ownership as unique_ptr allows only one)
    std::unique_ptr<GraphicsObject> obj = nullptr;  // general object for color etc.(reducing lines attempt)
    if (activeTool == RectTool) {
        auto r = std::make_unique<Rectangle>();
        QRectF rect = static_cast<QGraphicsPathItem*>(previewItem)->path().boundingRect();
        r->x = rect.x(); r->y = rect.y(); r->width = rect.width(); r->height = rect.height();r->rx = curr_r; r->ry = curr_r;
        obj = std::move(r);
    } else if (activeTool == CircleTool) {
        auto c = std::make_unique<Circle>();
        QRectF rect = static_cast<QGraphicsEllipseItem*>(previewItem)->rect();
        c->cx = rect.center().x(); c->cy = rect.center().y(); c->r = rect.width()/2.0;
        obj = std::move(c);
    } else if (activeTool == LineTool) {
        auto l = std::make_unique<line>();
        QLineF line = static_cast<QGraphicsLineItem*>(previewItem)->line();
        l->x1 = line.p1().x(); l->y1 = line.p1().y(); l->x2 = line.p2().x(); l->y2 = line.p2().y();
        obj = std::move(l);
    } else if (activeTool == HexagonTool) {
        auto h = std::make_unique<Hexagon>();
        double r = QLineF(startPoint, e->scenePos()).length();
        h->cx = startPoint.x(); h->cy = startPoint.y(); h->r = r;
        h->angle = std::atan2(e->scenePos().y()-startPoint.y(), e->scenePos().x()-startPoint.x());
        obj = std::move(h);
    } else if (activeTool == FreeTool) {
        auto f = std::make_unique<FreeHand>();
        QPainterPath path = static_cast<QGraphicsPathItem*>(previewItem)->path();
        for(int i=0; i<path.elementCount(); ++i) f->points.push_back(QPointF(path.elementAt(i).x, path.elementAt(i).y));
        obj = std::move(f);
    }
    if(obj){   // Updating color parameters common to all
        obj->stroke_Color = currentStroke; obj->fill_Color = currentFill; obj->strokeWidth = currentWidth;
        modelVector->push_back(std::move(obj)); // transferring ownership to modelvector for undo 
    }
}void mouseEvents::applyPreviewStyle() { // Applies later changes when selected object
    QPen pen(currentStroke); pen.setWidth(currentWidth);
    if (auto p = dynamic_cast<QAbstractGraphicsShapeItem*>(previewItem)) {  //AbstractGraphics is more general object type with all option of pen and brush (execpt line)
        p->setPen(pen); p->setBrush(activeTool != FreeTool ? QBrush(currentFill) : Qt::NoBrush);
    }else if (auto l = dynamic_cast<QGraphicsLineItem*>(previewItem)) l->setPen(pen);  //hence line made separately
}