const SCHOOL_ITEMS = [
  { id: 'vhu', label: 'VHU', sub: 'ĐH Văn Hiến', icon: '🎓', badge: 'Sẵn sàng', badgeCls: 'green' },
  { id: 'huflit', label: 'HUFLIT', sub: 'ĐH Ngoại ngữ - Tin học', icon: '🏫', badge: 'Sẵn sàng', badgeCls: 'green' },
];

export default function SchoolNav({ activePage, onSelect }) {
  return (
    <aside className="card sidebar" aria-label="Menu chọn trường">
      <button
        type="button"
        className="sidebar-brand"
        onClick={() => onSelect('home')}
      >
        <span className="nav-logo">🎓</span>
        <span>
          <strong>Auto-Register</strong>
          <small>Cổng đăng ký học phần</small>
        </span>
      </button>

      <div className="sidebar-section">
        <button
          type="button"
          className={`sidebar-item ${activePage === 'home' ? 'active' : ''}`}
          onClick={() => onSelect('home')}
        >
          <span className="sidebar-item-left">
            <span>🏠</span>
            <span>
              <strong>Trang chủ</strong>
              <small>Tổng quan & Chọn trường</small>
            </span>
          </span>
        </button>
      </div>

      <div className="sidebar-label">Danh sách trường</div>
      <div className="sidebar-section">
        {SCHOOL_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="sidebar-item-left">
                <span>{item.icon}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.sub}</small>
                </span>
              </span>
              <span className={`nav-pill ${item.badgeCls}`}>{item.badge}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        Mỗi trường chạy độc lập: Token, cấu hình API và nhật ký tách biệt hoàn toàn.
      </div>
    </aside>
  );
}
