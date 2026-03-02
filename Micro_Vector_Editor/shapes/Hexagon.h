#pragma once
#include "GraphicsObject.h"
#include <QPointF>
#include <cmath>

class Hexagon : public GraphicsObject {
public:
    double cx, cy, r, angle;        // Uses centre cx centre cy radius and a rotation angle
    void move(double dx, double dy) override;
    void resize(double dx, double dy)override;
    std::string SVG() const override;
    bool contains(const QPointF p) const override;
    std::unique_ptr<GraphicsObject> clone() const override;
    void pastePos(double newX, double newY) override;
    QRectF getBounds() const override;
};