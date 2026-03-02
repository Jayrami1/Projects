#pragma once
#include "GraphicsObject.h"
#include <vector>
#include <QPointF>
class FreeHand : public GraphicsObject {
public:
    std::vector<QPointF> points;        // Stores the path as sequence of points 
    void move(double dx, double dy) override;
    void resize(double dx, double dy)override;
    std::string SVG() const override;
    bool contains(const QPointF p) const override;
    std::unique_ptr<GraphicsObject> clone() const override;
    void pastePos(double newX, double newY) override;
    QRectF getBounds() const override;
};