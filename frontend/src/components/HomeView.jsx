const SCHOOLS = [
  {
    id: 'vhu',
    code: 'VHU',
    name: 'Trường Đại học Văn Hiến',
    status: 'Đang hoạt động',
    statusCls: 'green',
    desc: 'Đăng nhập cổng sinh viên VHU, tra cứu lớp học phần, canh slot nhiều môn song song và tự động đăng ký.',
    cta: 'Vào công cụ VHU →',
  },
  {
    id: 'huflit',
    code: 'HUFLIT',
    name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM',
    status: 'Đang hoạt động',
    statusCls: 'green',
    desc: 'Kết nối cổng đăng ký tín chỉ HUFLIT, dán Token phiên làm việc, tra cứu lớp học phần và canh slot tự động.',
    cta: 'Vào công cụ HUFLIT →',
  },
];

const HIGHLIGHTS = [
  {
    title: 'Lưu cục bộ & An toàn',
    desc: 'Mật khẩu không được lưu lại; chỉ lưu Token phiên vào file .env trên máy của bạn.',
  },
  {
    title: 'Độc lập theo từng trường',
    desc: 'Mỗi trường có API, Token, danh sách môn đang canh và nhật ký hoạt động riêng biệt.',
  },
  {
    title: 'Theo dõi Realtime',
    desc: 'Cập nhật số chỗ trống liên tục và phát âm thanh thông báo ngay khi đăng ký thành công.',
  },
];

export default function HomeView({ onSelectSchool }) {
  return (
    <section className="home-wrap">
      <div className="card home-hero">
        <span className="badge blue" style={{ marginBottom: 10 }}>
          Hệ thống hỗ trợ đăng ký học phần cục bộ
        </span>
        <h2>Chọn cổng trường để bắt đầu</h2>
        <p>
          Chọn trường ở thanh điều hướng bên trái hoặc chọn trực tiếp bên dưới. Mỗi cổng trường hoạt động hoàn toàn độc lập.
        </p>

        <div className="trust-grid">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="trust-item">
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="school-grid">
        {SCHOOLS.map((school) => (
          <article key={school.id} className="card school-card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="school-code">{school.code}</div>
                <h3 className="school-name">{school.name}</h3>
              </div>
              <span className={`badge ${school.statusCls}`}>{school.status}</span>
            </div>

            <p className="school-desc">{school.desc}</p>

            <button
              type="button"
              className="btn-primary"
              onClick={() => onSelectSchool(school.id)}
              style={{ alignSelf: 'flex-start' }}
            >
              {school.cta}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
