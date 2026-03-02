#ifndef SVGPARSER_H
#define SVGPARSER_H

#include <string>
#include <vector>
#include <memory>
#include "GraphicsObject.h"
#include "Rectangle.h"
#include "Circle.h"
#include "line.h"
#include "Hexagon.h"
#include "Text.h"
#include "FreeHand.h"
class SVGParser {
public: //static allows directly calling methods without mentioning class it is present in
    static std::string exportToSVG(const std::vector<std::unique_ptr<GraphicsObject>>& objects, int width, int height); // Function that return string SVG format

    static void importFromSVG(const std::string& content, std::vector<std::unique_ptr<GraphicsObject>>& objects);   // Scans and parses SVG

private:
    static std::string extract(const std::string& line, const std::string& attr);   //extract finds the attributes and returns value
};

#endif