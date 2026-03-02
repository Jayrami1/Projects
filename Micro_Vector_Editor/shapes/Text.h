#pragma once
#include<QObject>
#include "GraphicsObject.h"
class Text : public GraphicsObject {
public:
    double x, y;        // Coordinates
    int font_size = 20; // Default font_size
    std::string content = "Demo" ;  // content placeholder
    std::string SVG() const override;   
    bool contains(const QPointF p) const override;
    std::unique_ptr<GraphicsObject> clone() const override;
    void pastePos(double nx, double ny) override ;
    void move(double dx, double dy) override;
    void resize(double dx, double dy) override;
    QRectF getBounds() const override;
    std::string font_family = "Arial";  // Fontstyle specified using this variable
};