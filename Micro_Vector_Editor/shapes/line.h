#pragma once

#include <QObject>
#include"GraphicsObject.h"
class line : public GraphicsObject{
    public:
        double x1,y1,x2,y2;     // Stores the endpoints of line
    void move(double dx, double dy) override;
    void resize(double dx, double dy)override;
    std::string SVG() const override;
    bool contains(QPointF p) const override;
    std::unique_ptr<GraphicsObject> clone() const override;
    void pastePos(double newX, double newY) override;
    QRectF getBounds() const override;
};