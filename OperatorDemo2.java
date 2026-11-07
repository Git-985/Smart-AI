package com.itheima.operator;

import java.util.Scanner;

public class OperatorDemo2 {
    public static void main(String[] args) {
        //键盘录入一个三位数
        Scanner sc = new Scanner(System.in);
        System.out.println("请输入一个三位数：");
        int num = sc.nextInt();
        System.out.println(num);

        int ge = num % 10;
        System.out.println(ge);

        int shi = num / 10 % 10;
        System.out.println(shi);

        int bai = num / 100 % 10;
        System.out.println(bai);
        /*
        公式总结：个位
                    a % 10
                 十位
                    b / 10 % 10
                 百位
                    c / 100 % 10
                 千位
                    d / 1000 % 10
                  等等...
         */
    }
}
