import { TextX } from '@/components/ui/text';
import SvgChart, { SVGRenderer } from '@wuba/react-native-echarts/svgChart';
import { LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import React, { useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Colors } from '~/theme/colors';

echarts.use([SVGRenderer, LineChart, GridComponent]);

export default function ChartWeight() {
    const { width: deviceWidth } = useWindowDimensions();

    const chartRef = useRef<any>(null);

    useEffect(() => {
        const option = {
            grid: {
                left: 4,
                right: 4,
                top: 4,
                bottom: 4,
                containLabel: false,
            },
            xAxis: {
                type: 'category',
                show: false,
                boundaryGap: false,
            },
            yAxis: {
                type: 'value',
                show: false,
            },
            series: [
                {
                    data: [4, 10, 6, 8, 4, 9, 7],
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        width: 3,
                        color: Colors.light.blue,
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {
                                offset: 0,
                                color: 'rgba(10,132,255,0.4)',
                            },
                            {
                                offset: 0.6,
                                color: 'rgba(10,132,255,0)',
                            },
                        ]),
                    },
                },
            ],
        };
        let chart: any;
        if (chartRef.current) {
            chart = echarts.init(chartRef.current, 'light', {
                renderer: 'svg',
                width: (deviceWidth / 5) * 3,
                height: 80,
            });
            chart.setOption(option);
        }
        return () => chart?.dispose();
    }, []);

    return (
        <View className="flex w-full flex-row items-stretch justify-between overflow-hidden rounded-xl bg-white px-3.5 pb-2 pt-3.5 shadow-lg">
            <View className="flex justify-between">
                <View className="flex flex-row items-center">
                    <Button size="sm">记录体重</Button>
                </View>

                <View className="ml-1 flex flex-row items-baseline">
                    <TextX className="text-4xl font-medium">6.2</TextX>
                    <TextX className="ml-1">kg</TextX>
                </View>
            </View>

            <View className="translate-y-5">
                <SvgChart ref={chartRef} />
            </View>
        </View>
    );
}
