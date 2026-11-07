package com.itheima.variable;

import java.util.Scanner;

public class VariableDemo7 {
    public static void main(String[] args) {
        /*定义两个整数类型num1，num2
        键盘录入数据分别为两个变量赋值。
        求两个数并进行打印
         */

        //1.定义变量
        Scanner sc = new Scanner(System.in);

        //让scanner干活
        System.out.println("请键盘录入一个整数：");
        int num1 = sc.nextInt();
        System.out.println(num1);

        //3.让scanne再次接收第二个整数
        System.out.println("请键盘录入第二个整数");
        int num2 = sc.nextInt();
        System.out.println(num2);


        //求和
        int result = num1 + num2;
        System.out.println(result);
    }
}
