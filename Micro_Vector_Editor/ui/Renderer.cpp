#include "mainwindow.h"
#include "Rectangle.h"
#include "Circle.h"
#include "line.h"               
#include "Hexagon.h"
#include "FreeHand.h"
#include "Text.h"
#include <QPainterPath>
#include <cmath>
#include <QGraphicsTextItem>
void MainWindow::updateSceneFromModel() {   //Object creation on scene similar to mouseEvents preview realization
    scene->clear(); //clears scene
    GraphicsObject* selected = scene->getSelectedObject();  // get selected obj

    for (const auto& obj : diagramObjects) {        // draws the scene again based on diagramObjects vector
        if (!obj) continue;
        QPen p(obj->stroke_Color);          // Pen and brush defined and given obj parameters
        p.setWidth(obj->strokeWidth);
        QBrush b(obj->fill_Color);
        if (auto r = dynamic_cast<Rectangle*>(obj.get())) {     //Cast to rectangle and update parameters of scene as added object
            QPainterPath path;
            path.addRoundedRect(r->x, r->y, r->width, r->height, r->rx, r->ry);
            scene->addPath(path, p, b);
        }
        else if (auto c = dynamic_cast<Circle*>(obj.get())) {   // Similar for all objects cast to type based on obj type and adds it to scene
            scene->addEllipse(c->cx - c->r, c->cy - c->r, c->r * 2, c->r * 2, p, b);
        }
        else if (auto l = dynamic_cast<line*>(obj.get())) {
            scene->addLine(l->x1, l->y1, l->x2, l->y2, p);
        }
        else if (auto h = dynamic_cast<Hexagon*>(obj.get())) {
            QPolygonF poly;
            for (int i = 0; i < 6; i++) {
                double theta = h->angle + (i * M_PI / 3);
                poly << QPointF(h->cx + h->r * cos(theta), h->cy + h->r * sin(theta));
            }
            scene->addPolygon(poly, p, b);
        }
        else if (auto t = dynamic_cast<Text*>(obj.get())) {
            auto item = scene->addText(QString::fromStdString(t->content));
            item->setPos(t->x, t->y);
            item->setDefaultTextColor(t->fill_Color);
            QFont f(QString::fromStdString(t->font_family));
            f.setPointSize(t->font_size);
            item->setFont(f);
        }
        else if (auto f = dynamic_cast<FreeHand*>(obj.get())) {
            if (!f->points.empty()) {
                QPainterPath path;
                path.moveTo(f->points[0]);
                for (size_t i = 1; i < f->points.size(); ++i) path.lineTo(f->points[i]);
                scene->addPath(path, p);
            }
        }
    }

    if (selected) { // if selected object then bounds are drawn blue dash lines
        QRectF b = selected->getBounds();
        QPen selPen(Qt::blue, 1, Qt::DashLine);
        scene->addRect(b, selPen);  // rect made as per parameters of getBounds
        double s = 6;
        QBrush hBrush(Qt::black); QPen hPen(Qt::black);     //Handle color 
        auto drawHandle = [&](QPointF center) {     // Functor to easily get handles on bound
            scene->addRect(center.x()-s/2, center.y()-s/2, s, s, hPen, hBrush);
        };
        drawHandle(b.topLeft());    //Functor called 
        drawHandle(b.topRight());
        drawHandle(b.bottomLeft());
        drawHandle(b.bottomRight());
    }
}