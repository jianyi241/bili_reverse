const a = '/assets'

export type Video = {
  id: number; title: string; cat: string; tag: string; time: string; dur: string
  cover: string; author: string; avatar: string; views: string; likes: string; comments: string; followed?: boolean
}

export const categories = ['全部', '影视美学', '现场演出', '纪录观察', '科技解构', '独立摄影', '建筑空间', '轻音乐']

export const videos: Video[] = [
  { id: 1, title: '东京雨夜：声学与漫步氛围，胶片感街头光影', cat: '影视美学', tag: '4K HDR', time: '3 小时前', dur: '18:50', cover: `${a}/e37c3.png`, author: '陈墨影调社', avatar: `${a}/27054.png`, views: '128.4万', likes: '8.9万', comments: '4,210' },
  { id: 2, title: '清水混凝土的静默之诗：野兽派空间里的呼吸与留白', cat: '建筑空间', tag: '8K', time: '5 小时前', dur: '12:14', cover: `${a}/03315.png`, author: 'Kite 建筑', avatar: `${a}/fa08e.png`, views: '64.2万', likes: '5.2万', comments: '1,840', followed: true },
  { id: 3, title: '全模拟模块合成器现场：波形雕琢与深邃低频', cat: '现场演出', tag: '杜比全景声', time: '8 小时前', dur: '24:08', cover: `${a}/89505.png`, author: '声景实验室', avatar: `${a}/b759f.png`, views: '41.9万', likes: '3.7万', comments: '962' },
  { id: 4, title: '微米级拆解：机械计时码表的纯物理平衡美学', cat: '科技解构', tag: '4K 60帧', time: '昨天', dur: '09:42', cover: `${a}/6a4b3.png`, author: '工业与微观', avatar: `${a}/347f0.png`, views: '87.5万', likes: '9.1万', comments: '3,190' },
  { id: 5, title: '冰岛极境：黑沙滩与冰川之风的长镜头记录', cat: '纪录观察', tag: '4K 10bit', time: '2 天前', dur: '31:20', cover: `${a}/9359f.png`, author: '地球边缘纪录', avatar: `${a}/272d3.png`, views: '92.3万', likes: '7.8万', comments: '2,530' },
  { id: 6, title: '慢下来的银盐胶片：6×6 双反画幅构图与日常', cat: '独立摄影', tag: '4K HDR', time: '3 天前', dur: '15:06', cover: `${a}/a091f.png`, author: '胶片日记', avatar: `${a}/5a081.png`, views: '53.1万', likes: '4.6万', comments: '1,290' },
  { id: 7, title: '极紫外光刻机底层机制：物理极限与晶体管制造', cat: '科技解构', tag: '4K 60帧', time: '4 天前', dur: '21:40', cover: `${a}/9a1bb.png`, author: '物理边界', avatar: `${a}/787b0.png`, views: '175.8万', likes: '12.4万', comments: '6,780', followed: true },
  { id: 8, title: '柏林地下爵士即兴夜：低音提琴与萨克斯的漫游', cat: '轻音乐', tag: '无损 96k', time: '5 天前', dur: '27:12', cover: `${a}/cf929.png`, author: '蓝调档案馆', avatar: `${a}/89969.png`, views: '32.7万', likes: '2.9万', comments: '810' },
]

export const transcript = [
  { t: '00:12', s: '欢迎来到今晚的雨夜漫步。' },
  { t: '00:31', s: '雨滴落在伞面上的声音，是这座城市最温柔的底噪。' },
  { t: '01:05', s: '我们沿着霓虹的倒影，慢慢走进巷子深处。' },
  { t: '01:48', s: '远处电车驶过，低频在胸腔里轻轻共振。' },
  { t: '02:20', s: '如果你戴着耳机，不妨闭上眼睛听一会儿。' },
  { t: '03:02', s: '这一段，我们只留下环境声。' },
]

export type Song = { title: string; artist: string; album: string; match: number; from: string; to: string; cover: string }

export const songsFor = (v: { id: number; cover: string }): Song[] => [
  { title: v.id % 2 ? 'Rainy Window' : 'Slow Tide', artist: v.id % 2 ? 'Mina Okabe' : 'Hollow Pines', album: '夜间电台 Vol.3', match: 96, from: '00:42', to: '03:15', cover: v.cover },
  { title: v.id % 2 ? '雾中的车站' : '回声之间', artist: v.id % 2 ? '林间乐队' : '白昼与灯', album: '静默旅行', match: 88, from: '05:08', to: '08:40', cover: v.cover },
]
