/**
 * 添加域名解析弹框
 */

import { useState, useMemo } from 'react';
import type { DomainOption } from '../../../services/assets/domainMap';

interface AddDomainMapModalProps {
  visible: boolean;
  domains: DomainOption[];
  onSubmit: (subDomain: string, domain: string) => Promise<void>;
  onClose: () => void;
}

const AddDomainMapModal = ({ visible, domains, onSubmit, onClose }: AddDomainMapModalProps) => {
  const [subDomain, setSubDomain] = useState('');
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fullDomain = useMemo(
    () => (subDomain.trim() && domain ? `${subDomain.trim()}.${domain}` : ''),
    [subDomain, domain]
  );

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!subDomain.trim()) return;
    if (!domain) return;
    setSubmitting(true);
    try {
      await onSubmit(subDomain.trim(), domain);
      setSubDomain('');
      setDomain('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubDomain('');
    setDomain('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content dm-add-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>添加域名解析</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="dm-add-form">
            <div className="form-group">
              <label>子域名前缀</label>
              <input
                placeholder="如: testok"
                value={subDomain}
                onChange={e => setSubDomain(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>主域名</label>
              <select value={domain} onChange={e => setDomain(e.target.value)}>
                <option value="">请选择主域名</option>
                {domains.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            {fullDomain && (
              <div className="dm-add-preview">
                <label>完整域名</label>
                <div className="dm-add-preview-domain">{fullDomain}</div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-default" onClick={handleClose}>取消</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!subDomain.trim() || !domain || submitting}
          >
            {submitting ? '添加中...' : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDomainMapModal;
