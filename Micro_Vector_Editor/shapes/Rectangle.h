#pragma once

#include <QObject>
#include"GraphicsObject.h"
class Rectangle : public GraphicsObject{
    public:
        double x,y,width,height;    // Stores the x,y of one point then width and height of rectangle 
        double rx=0,ry=0;           // rx,ry for rounded rectangle 
    void move(double dx, double dy) override;
    void resize(double dx, double dy) override;
    std::string SVG() const override;
    bool contains(QPointF p) const override;
    std::unique_ptr<GraphicsObject> clone() const override;
    void pastePos(double newX, double newY) override;
    QRectF getBounds() const override;
};