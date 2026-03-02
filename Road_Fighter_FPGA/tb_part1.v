
`timescale 1ns / 1ps

module tb_part3();

    // Testbench signals
    reg clk;
    reg btnC, btnR, btnL;
    wire HS, VS;
    wire [11:0] vgaRGB;

    // Instantiate Display_sprite with FASTER parameters for simulation visibility
    Display_sprite #(
        .pixel_counter_width(10),
        .OFFSET_BG_X(200),
        .OFFSET_BG_Y(150),
        .BACKGROUND_SPEED(10),
        .CAR_SPEED_INV(75000),
        .LFSR_CONST(8'b00111100),
        .FRAMES_BUFFER(1)              // Change to lower for finer collision
    ) uut (
        .clk(clk),
        .btnC(btnC),
        .btnR(btnR),
        .btnL(btnL),
        .HS(HS),
        .VS(VS),
        .vgaRGB(vgaRGB)
    );
    // Clock generation: 100 MHz
    initial clk = 0;
    always #5 clk = ~clk;

    initial begin
        #100
        #100
        btnC = 0; btnR = 0; btnL = 0;
        #1000;
        btnC = 1; #50000; btnC = 0;
        #100000;
        btnR = 1;
        #500000;
        btnR = 0;
        #200000;
        #300000;
        btnL = 1;
        #500000;
        btnL = 0;
        #200000;

        btnL = 1;
        #2000000;
        btnL = 0;
        #100000;
        btnC = 1; #50000; btnC = 0;
        #200000;
        btnR = 1;
        #2000000;
        btnR = 0;
        #100000;

        #300000000;

        $finish;
    end

endmodule
