

`timescale 1ns/1ps

// older module
module debouncer #(
    parameter WIDTH = 13,
    parameter COUNTER_BITS = 3,
    parameter THRESHOLD = 3
)(
    input  wire [WIDTH-1:0] in,
    input  wire clk,
    output reg [WIDTH-1:0] out
);

  reg [COUNTER_BITS-1:0] counter [WIDTH-1:0];
    reg flag [WIDTH-1:0];

    integer i;
    initial begin
        for (i = 0; i < WIDTH; i = i + 1) begin
            out[i] = 0;
            counter[i] = 0;
            flag[i] = 0;
        end
    end

    genvar g;
    generate
        for (g = 0; g < WIDTH; g = g + 1) begin : gen_loop
            always @(posedge clk) begin
                if (in[g] != out[g])
                    flag[g] <= 1;

                if (flag[g])
                    counter[g] <= counter[g] + 1;
                else
                    counter[g] <= 0;

                if (flag[g] && counter[g] >= THRESHOLD) begin
                    out[g] <= in[g];
                    flag[g] <= 0;
                    counter[g] <= 0;
                end
            end
        end
    endgenerate
endmodule

//=============================================================================
// MAC Module
//=============================================================================

module MAC #(
    parameter INITIAL_VALUE = 16'h0000
)(

    input btnC,
    input mac_initiate,
    input [7:0] b, c,
    input clk,

    output [15:0] led,

    output reg [15:0] accumulator,
    output reg reset_display_active,
    output reg overflow_flag
);
    assign dp = 1;
    assign an = 4'b1111;  // Disable display in MAC
    assign seg = 7'b1111111;

    // Internal registers
    reg [7:0] b_reg, c_reg;
    reg [31:0] reset_display_counter;

//    initial begin
//        overflow_flag = 0;
//        accumulator = INITIAL_VALUE;
//        reset_display_active = 0;
//        reset_display_counter = 0;
//        b_reg = 8'h00;
//        c_reg = 8'h00;
//    end

    // 8-bit multiplier
    wire [15:0] product = b * c;

    wire [16:0] sum = accumulator + product;// live assignment


    // Clocked logic
    always @(posedge clk) begin
//        b_reg = b;
//        c_reg = c;

        if (btnC) begin
            accumulator <= INITIAL_VALUE;
            overflow_flag <= 1'b0;
            reset_display_active <= 1'b1;
            reset_display_counter <= 32'h0;
//        end /*else if(rst) begin
//          accumulator <= INITIAL_VALUE;
//          overflow_flag <= 1'b0;
        end else begin
            if (reset_display_active) begin
                reset_display_counter <= reset_display_counter + 1;
                if(reset_display_counter >= 32'd500_000_000 )  //500_000_000 20 clock cycles at 100MHz                            ----------frequency change needed.
                    reset_display_active <= 1'b0;
            end

            // MAC operation - triggered by external controller
            if (!overflow_flag && b != 8'h00 && c != 8'h00 && mac_initiate) begin
                if (sum[16]) begin
                    overflow_flag <= 1'b1;
                end else begin
                    accumulator <= sum[15:0];
                end
            end
        end
    end

    assign led = overflow_flag ? 16'b0 : accumulator;

endmodule


module seven_segment_display(
    input clk,
    input [2:0] mode,          // 0=blank,1=data,2=-rSt,3=OFLO
    input [15:0] value,        // hex value to display
    output reg [3:0] an,
    output reg [6:0] seg
);

    reg [1:0] digit_select;
    reg [16:0] refresh_counter;
    reg [4:0] char_data;

    initial begin
        an = 4'b1111;
        seg = 7'b1111111;
        refresh_counter = 0;
    end

    always @(posedge clk) begin
        refresh_counter <= refresh_counter + 1;
        digit_select <= refresh_counter[16:15]; //                         ------------------frequency change needed.
    end

    always @(*) begin
        case(digit_select)
            2'b00: an = 4'b1110; // digit 0 active
            2'b01: an = 4'b1101; // digit 1 active
            2'b10: an = 4'b1011; // digit 2 active
            2'b11: an = 4'b0111; // digit 3 active
            default: an = 4'b1111;
        endcase
    end

    always @(*) begin
        case(mode)
            3'd0: char_data = 5'd31; // blank
            3'd1: case(digit_select)       // show hex digits of value
                2'b00: char_data = {1'b0, value[3:0]};
                2'b01: char_data = {1'b0, value[7:4]};
                2'b10: char_data = {1'b0, value[11:8]};
                2'b11: char_data = {1'b0, value[15:12]};
                default: char_data = 5'd31;
            endcase
            3'd2: case(digit_select)      // "-rSt"
                2'b11: char_data = 5'd17; // -
                2'b10: char_data = 5'd18; // r
                2'b01: char_data = 5'd19; // s
                2'b00: char_data = 5'd20; // t
                default: char_data = 5'd31;
            endcase
            3'd3: case(digit_select)      // "OFLO"
                2'b11: char_data = 5'd0;  // O
                2'b10: char_data = 5'd15; // F
                2'b01: char_data = 5'd16; // L
                2'b00: char_data = 5'd0;  // O
                default: char_data = 5'd31;
            endcase
            3'd4: case(digit_select)       // show hex digits of value
                2'b00: char_data = {1'b0, value[3:0]};
                2'b01: char_data = {1'b0, value[7:4]};
//                2'b10: char_data = {1'b0, value[11:8]};
//                2'b11: char_data = {1'b0, value[15:12]};
                default: char_data = 5'd31;
            endcase
            default: char_data = 5'd31;   // blank
        endcase
    end

    always @(*) begin
        case(char_data)
            // 0-F digits
            5'd0:  seg = 7'b1000000; // 0
            5'd1:  seg = 7'b1111001; // 1
            5'd2:  seg = 7'b0100100; // 2
            5'd3:  seg = 7'b0110000; // 3
            5'd4:  seg = 7'b0011001; // 4
            5'd5:  seg = 7'b0010010; // 5
            5'd6:  seg = 7'b0000010; // 6
            5'd7:  seg = 7'b1111000; // 7
            5'd8:  seg = 7'b0000000; // 8
            5'd9:  seg = 7'b0010000; // 9
            5'd10: seg = 7'b0001000; // A
            5'd11: seg = 7'b0000011; // b
            5'd12: seg = 7'b1000110; // C
            5'd13: seg = 7'b0100001; // d
            5'd14: seg = 7'b0000110; // E
            5'd15: seg = 7'b0001110; // F
            //'OFLO'
            5'd16: seg = 7'b1000111; //L
            // '-rSt'
            5'd17: seg = 7'b0111111; // dash '-'
            5'd18: seg = 7'b0101111; // r
            5'd19: seg = 7'b0010010; // s (should be S)
            5'd20: seg = 7'b0000111; // t

            default: seg = 7'b1111111;
        endcase
    end

endmodule

//=============================================================================
// DPC (Dot Product Controller) Module
//=============================================================================

module DPC(
  input[15:0] sw,
  input btnC,
  input clk,
  output[15:0] led,
  output[6:0] seg,
  output[3:0] an,
  output dp
);
  assign dp = 1;

  // Internal signals
  wire [7:0] mac_input_b, mac_input_c;
  wire [15:0] accumulator;
  wire overflow_flag, reset_display_active;

  reg initiate_mac, dot_product_computed;
  reg [7:0] A[3:0];
  reg [7:0] B[3:0];
  reg [3:0] A_written, B_written;
  reg [3:0] counter;

  // Display control
  reg [2:0] display_mode;
  reg [15:0] display_value;
  wire mac_enable;

  wire btnC_debounced;
  debouncer #(
    .WIDTH(1),
    .COUNTER_BITS(3),
    .THRESHOLD(3)
  ) debounce_inst (
    .in(btnC),
    .clk(clk),
    .out(btnC_debounced)
  );

  integer i;
//  initial begin
//    for(i=0; i<4; i=i+1) begin
//      A[i] = 8'b00000000;
//      B[i] = 8'b00000000;
//    end
//    A_written = 4'b0000;
//    B_written = 4'b0000;
//    dot_product_computed = 0;
//    counter = 4'b0000;
//    initiate_mac = 0;
//    display_mode = 3'b000;
//    display_value = 16'b0;
//  end

  // Reset logic
  always @(posedge clk) begin
    if (btnC_debounced) begin
      for(i=0; i<4; i=i+1) begin
        A[i] <= 8'b00000000;
        B[i] <= 8'b00000000;
      end
      A_written <= 4'b0000;
      B_written <= 4'b0000;
      dot_product_computed <= 0;
      counter <= 4'b0000;
      initiate_mac <= 0;
    end
    else if(!(A_written==4'b1111 && B_written==4'b1111)) begin
      if (sw[12]) begin
        A[sw[9:8]] <= sw[7:0];
        A_written[sw[9:8]] <= 1'b1;
      end
      if (sw[13]) begin
        B[sw[9:8]] <= sw[7:0];
        B_written[sw[9:8]] <= 1'b1;
      end
    end
    if (A_written == 4'b1111 && B_written == 4'b1111 && !dot_product_computed && !btnC_debounced) begin
        initiate_mac <= 1'b1;
      end



//    if ((A[0] !== A[0] || A[1] !== A[1] || A[2] !== A[2] || A[3] !== A[3] ||
//      B[0] !== B[0] || B[1] !== B[1] || B[2] !== B[2] || B[3] !== B[3]) && initiate_mac) begin
//        rest <= 1;
//        ctr <= 0;
//    end
//    if(rest) begin
//      ctr<=ctr+1;
//    end
//    if(ctr==3'd2) begin
//      ctr<=ctr+1;
//      rest<=0;
//      dot_product_computed<=0;
//      counter=0;
//    end



    if (mac_enable && counter < 4) begin
      counter <= counter + 1;
    end else if (counter >= 4) begin
      dot_product_computed <= 1;
    end
  end





  // MAC enable
  assign mac_enable = initiate_mac & ~dot_product_computed;

  // now i have to write logic for changing values of A,B....

//  wire rst=rest;
//  reg rest;
//  reg [2:0] ctr;
//  initial begin
//    rest=0;
//    ctr=3'd3;
//  end

  // Counter logic for dot product computation

  // MAC inputs
  assign mac_input_b = (counter > 3) ? 8'b0 : A[counter];
  assign mac_input_c = (counter > 3) ? 8'b0 : B[counter];


  // MAC unit instantiation
  MAC uut(
    .b(mac_input_b),
    .c(mac_input_c),
    .btnC(btnC_debounced),
    .mac_initiate(mac_enable),
    .clk(clk),
    .led(led),
    .accumulator(accumulator),
    .overflow_flag(overflow_flag),
    .reset_display_active(reset_display_active)
  );

  // Display mode logic
  always @(posedge clk) begin
    if (reset_display_active)
      display_mode <= 3'd2;    // "-rSt"
    else if (overflow_flag)
      display_mode <= 3'd3;    // "OFLO"
    else if (dot_product_computed && sw[14] && sw[15]) begin
      display_mode <= 3'd1;    // dot product
      display_value <= accumulator;
    end
    else if (sw[14] && !sw[15]) begin
      display_mode <= 3'd4;    // show vector A
      display_value <= {8'd0, A[sw[9:8]]};
    end
    else if (sw[15] && !sw[14]) begin
      display_mode <= 3'd4;    // show vector B
      display_value <= {8'd0, B[sw[9:8]]};
    end
    else
      display_mode <= 3'd0;    // blank
  end

  // Seven segment display instantiation
  seven_segment_display display_unit(
    .clk(clk),
    .mode(display_mode),
    .value(display_value),
    .seg(seg),
    .an(an)
  );

endmodule