`timescale 1ns/1ps

module tb_DPC_focused;

    // Testbench signals
    reg clk;
    reg btnC;
    reg [15:0] sw;
    wire [3:0] an;
    wire [6:0] seg;
    wire [15:0] led;
    wire dp;

    // Instantiate DUT
    DPC uut (
        .clk(clk),
        .btnC(btnC),
        .sw(sw),
        .an(an),
        .seg(seg),
        .led(led),
        .dp(dp)
    );

    // Clock generation: 100 MHz (10ns period)
    initial begin
        clk = 0;
        forever #5 clk = ~clk;
    end

    // Task to write element to vector A
    task write_A(input [7:0] data, input [1:0] index);
        begin
            $display("Time: %0t - Writing A[%0d] = %0d", $time, index, data);
            sw = 16'b0;
            sw[7:0] = data;      // Data
            sw[9:8] = index;     // Index
            sw[12] = 1'b1;       // Write enable A
            #30;
            sw[12] = 1'b0;       // Release write enable
            #20;
        end
    endtask

    // Task to write element to vector B
    task write_B(input [7:0] data, input [1:0] index);
        begin
            $display("Time: %0t - Writing B[%0d] = %0d", $time, index, data);
            sw = 16'b0;
            sw[7:0] = data;      // Data
            sw[9:8] = index;     // Index
            sw[13] = 1'b1;       // Write enable B
            #30;
            sw[13] = 1'b0;       // Release write enable
            #20;
        end
    endtask

    // Task to read element from vector A
    task read_A(input [1:0] index);
        begin
            $display("Time: %0t - Reading A[%0d]", $time, index);
            sw = 16'b0;
            sw[9:8] = index;     // Index
            sw[14] = 1'b1;       // Read enable A
            #100;
            sw[14] = 1'b0;       // Release read enable
            #20;
        end
    endtask

    // Task to read element from vector B
    task read_B(input [1:0] index);
        begin
            $display("Time: %0t - Reading B[%0d]", $time, index);
            sw = 16'b0;
            sw[9:8] = index;     // Index
            sw[15] = 1'b1;       // Read enable B
            #100;
            sw[15] = 1'b0;       // Release read enable
            #20;
        end
    endtask

    // Task to show dot product result
    task show_result();
        begin
            $display("Time: %0t - Showing dot product result", $time);
            sw = 16'b0;
            sw[14] = 1'b1;
            sw[15] = 1'b1;
            #300;
            sw[14] = 1'b0;
            sw[15] = 1'b0;
        end
    endtask






    // Main test sequence
    initial begin
        // Enable waveform dump for EPWave
        $dumpfile("dump.vcd");
        $dumpvars(0, tb_DPC_focused);

        btnC = 0;
        sw = 16'b0;


        // Reset
        btnC = 1'b1; #100; btnC = 1'b0;

        #600;

        // Write vectors
        $display("Writing Vector A...");
        write_A(8'd2, 2'd0);
        write_A(8'd3, 2'd1);
        write_A(8'd1, 2'd2);
        write_A(8'd6, 2'd3);

        $display("Writing Vector B...");
        write_B(8'd4, 2'd0);
        write_B(8'd3, 2'd1);
        write_B(8'd2, 2'd2);
        write_B(8'd5, 2'd3);



        sw = 16'b0;
        #500;
        #100;
        show_result();

        #100;
        btnC=1;#100;btnC=0;
        #150;
        // Overflow test: use large values that will cause dot product to overflow 8 bits
        $display("Overflow Test: Writing large values to A and B...");
        write_A(8'd255, 2'd0);
        write_A(8'd255, 2'd1);
        write_A(8'd255, 2'd2);
        write_A(8'd255, 2'd3);

        write_B(8'd255, 2'd0);
        write_B(8'd255, 2'd1);
        write_B(8'd255, 2'd2);
        write_B(8'd255, 2'd3);

        #100;
        show_result();
        btnC=1;#100;btnC=0;
        #200;
        $finish;
    end

endmodule