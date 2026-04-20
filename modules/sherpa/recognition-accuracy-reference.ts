import { Asset } from 'expo-asset';

const DEFAULT_ACCURACY_AUDIO_MODULE = require('../../assets/sherpa/wav/test.wav');

const DEFAULT_TIMED_REFERENCE_LINES = `
29.776 -- 35.788: 晚上好，欢迎大家来参加今天晚上的活动。谢谢大家。
42.160 -- 45.996: 这是我第四次办年度演讲。
47.024 -- 49.868: 前三次呢，因为疫情的原因。
50.512 -- 55.340: 都在小米科技园内举办，现场的人很少。
56.176 -- 57.388: 这是第四次。
58.192 -- 66.892: 我们仔细想了想，我们还是想办一个比较大的聚会，然后呢，让我们的新朋友、老朋友一起聚一聚。
67.760 -- 70.828: 今天的话呢，我们就在北京的。
71.664 -- 74.828: 国家会议中心呢，举办了这么一个活动。
75.472 -- 85.868: 现场呢，来了很多人，大概有三千五百人，还有很多很多的朋友呢，通过观看直播的方式来参与。
86.352 -- 91.308: 再一次呢，对大家的参加表示感谢，谢谢大家。
98.512 -- 99.692: 两个月前。
100.400 -- 104.396: 我参加了今年武汉大学的毕业典礼。
105.936 -- 107.276: 今年呢是。
107.888 -- 110.572: 武汉大学建校一百三十周年。
111.760 -- 117.196: 作为校友，被母校邀请，在毕业典礼上致辞。
118.032 -- 122.732: 这对我来说是至高无上的荣誉。
123.664 -- 128.556: 站在讲台的那一刻，面对全校师生。
129.200 -- 134.252: 关于武大的所有的记忆，一下子涌现在脑海里。
134.960 -- 139.436: 今天呢，我就先和大家聊聊五大往事。
141.840 -- 143.980: 那还是三十六年前。
145.936 -- 147.660: 一九八七年。
148.688 -- 151.564: 我呢，考上了武汉大学的计算机系。
152.688 -- 156.748: 在武汉大学的图书馆里，看了一本书。
157.584 -- 161.804: 硅谷之火，建立了我一生的梦想。
163.312 -- 164.652: 看完书以后。
165.264 -- 166.636: 热血沸腾。
167.600 -- 169.548: 激动得睡不着觉。
170.416 -- 171.404: 我还记得。
172.016 -- 174.700: 那天晚上，星光很亮。
175.408 -- 179.820: 我就在武大的操场上，就是屏幕上这个操场。
180.816 -- 185.228: 走了一圈又一圈，走了整整一个晚上。
186.480 -- 187.916: 我心里有团火。
188.912 -- 192.076: 我也想搬一个伟大的公司。
193.968 -- 195.020: 就是这样。
197.648 -- 202.316: 梦想之火，在我心里彻底点燃了。
209.968 -- 212.396: 是一个大一的新生。
220.496 -- 222.636: 是一个大一的新生。
223.984 -- 226.892: 一个从县城里出来的年轻人。
228.368 -- 230.604: 什么也不会，什么也没有。
231.568 -- 236.204: 就想创办一家伟大的公司，这不就是天方夜谭吗？
237.616 -- 239.788: 这么离谱的一个梦想。
240.400 -- 242.316: 该如何实现呢？
243.856 -- 246.924: 那天晚上，我想了一整晚上。
247.952 -- 249.068: 说实话。
250.352 -- 253.868: 越想越糊涂，完全理不清头绪。
254.960 -- 265.836: 后来我在想：“哎，干脆别想了，把书念好是正事。”所以呢，我就下定决心，认认真真读书。
266.640 -- 267.468: 那么。
268.496 -- 271.564: 我怎么能够把书读得不同凡响呢？
`;

export const DEFAULT_RECOGNITION_ACCURACY_TIMED_REFERENCE_TEXT = DEFAULT_TIMED_REFERENCE_LINES.trim();

export function extractReferenceTextFromTimedLines(timedText: string): string {
    return timedText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex < 0) {
                return line;
            }
            return line.slice(colonIndex + 1).trim();
        })
        .join('');
}

export const DEFAULT_RECOGNITION_ACCURACY_REFERENCE_TEXT = extractReferenceTextFromTimedLines(
    DEFAULT_RECOGNITION_ACCURACY_TIMED_REFERENCE_TEXT,
);

export async function resolveDefaultRecognitionAccuracyAudioUri(): Promise<string> {
    const asset = Asset.fromModule(DEFAULT_ACCURACY_AUDIO_MODULE);
    if (!asset.localUri) {
        await asset.downloadAsync();
    }
    const uri = asset.localUri ?? asset.uri;
    if (!uri) {
        throw new Error('Unable to resolve default test.wav URI');
    }
    return uri;
}
