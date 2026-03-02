#pragma once

#include <QObject>
#include"GraphicsObject.h"
class Circle : public GraphicsObject{
    public:
        double r,cx,cy;         // Variables for radius ,center x , center y
    void move(double dx, double dy) override;   // Override prevents it to create a different function inavidently make an overload function
    void resize(double dx, double dy)override;
    std::string SVG() const override;
    bool contains(QPointF p) const override;
    std::unique_ptr<GraphicsObject> clone() const override;
    void pastePos(double newX, double newY) override;
    QRectF getBounds() const override;
};