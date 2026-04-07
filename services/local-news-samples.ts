export const LOCAL_NEWS_SAMPLES = [
    {
        id: 'news-001',
        title: '多地发布数字基础设施升级计划',
        content:
            '近期，多地陆续公布数字基础设施升级方案，重点覆盖政务、医疗、教育与交通四个领域。方案提出在未来18个月内完成关键业务系统迁移与算力资源整合，并推动跨部门数据共享。业内人士指出，升级带来的短期挑战包括系统兼容改造、人才培训与预算控制，但中长期有望显著提升公共服务效率和业务连续性。部分试点地区已经在政务热线、审批流转和智慧交通调度中取得阶段性成果，平均响应时长下降约20%。',
    },
    {
        id: 'news-002',
        title: '制造企业加速智能质检落地',
        content:
            '在成本压力与交付周期双重驱动下，制造企业正在加速部署智能质检系统。多家工厂通过视觉检测与规则引擎结合，将缺陷识别时间从分钟级缩短到秒级。与此同时，企业也在探索将历史质检报告结构化，形成可追溯的知识库，以支持跨班组复盘和工艺优化。专家提醒，智能质检并非单点工具替换，仍需同步完善数据标注标准、异常回流机制和一线员工培训体系。',
    },
    {
        id: 'news-003',
        title: '城市更新项目强调绿色与韧性',
        content:
            '新一轮城市更新项目将“绿色低碳”和“韧性治理”作为核心指标。多个城市提出对老旧社区进行雨洪调蓄改造、公共空间微更新与能源系统优化。项目负责人表示，本轮更新将更重视居民参与和持续运营能力，避免一次性建设后维护不足。研究机构分析认为，城市更新成效的关键不只在建设投资，更在后续运营机制、跨部门协作和社区自治能力。',
    },
] as const;

export type LocalNewsItem = (typeof LOCAL_NEWS_SAMPLES)[number];

export function pickRandomNewsSample(): LocalNewsItem {
    const index = Math.floor(Math.random() * LOCAL_NEWS_SAMPLES.length);
    return LOCAL_NEWS_SAMPLES[index] ?? LOCAL_NEWS_SAMPLES[0];
}

