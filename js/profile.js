/* ============================================================
   profile.js — 用户公开主页（?id=N）
   展示皮肤站同步的昵称/头像/展示角色与用户自愿公开的档案字段；
   本人访问时显示「编辑档案」入口。
   ============================================================ */
(function () {
  'use strict';

  var API_AUTH = '../api/auth.php';
  var API_USER = '../api/user.php';

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
  }

  function formatTs(ts) {
    if (!ts) return '-';
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderProfile(user) {
    var avatar = document.getElementById('profileAvatar');
    if (user.avatar) {
      avatar.src = user.avatar;
      avatar.alt = user.nickname || '';
      avatar.style.display = '';
    } else {
      avatar.style.display = 'none';
    }
    document.getElementById('profileNickname').textContent = user.nickname || '未命名用户';

    var playerLine = document.getElementById('profilePlayerLine');
    if (user.player_name) {
      playerLine.textContent = '展示角色：' + user.player_name;
    } else {
      playerLine.textContent = '';
    }
    document.getElementById('profileJoined').textContent = formatTs(user.created_at);

    // 简介：空则给弱化占位
    var bio = document.getElementById('profileBio');
    if (user.bio) {
      bio.textContent = user.bio;
      bio.classList.remove('is-empty');
    } else {
      bio.textContent = '这个人很懒，还没有写简介。';
      bio.classList.add('is-empty');
    }

    // 社交链接：空则整节隐藏
    var linksSection = document.getElementById('linksSection');
    var links = user.social_links || [];
    if (links.length) {
      var html = '';
      for (var i = 0; i < links.length; i++) {
        var link = links[i] || {};
        html += '<li><a href="' + escapeAttr(link.url || '#') + '" target="_blank" rel="noopener">' + escapeHtml(link.label || link.url || '') + '</a></li>';
      }
      document.getElementById('profileLinks').innerHTML = html;
      linksSection.style.display = '';
    } else {
      linksSection.style.display = 'none';
    }

    // 联系方式：接口仅在用户允许公开时返回
    var contactSection = document.getElementById('contactSection');
    if (user.contact) {
      document.getElementById('profileContact').textContent = user.contact;
      contactSection.style.display = '';
    } else {
      contactSection.style.display = 'none';
    }

    document.getElementById('profileCardWrap').style.display = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var status = document.getElementById('profileStatus');
    var id = new URLSearchParams(location.search).get('id') || '';
    if (!id || !/^\d+$/.test(id)) {
      status.textContent = '缺少用户参数';
      return;
    }

    fetch(API_USER + '?action=public&id=' + encodeURIComponent(id)).then(function (res) {
      return res.json().then(function (json) {
        if (res.status === 404) {
          status.style.display = 'none';
          document.getElementById('profileEmpty').style.display = '';
          return;
        }
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'load failed');
        }
        status.style.display = 'none';
        renderProfile(json.data);

        // 本人访问时显示「编辑档案」（me 未登录静默忽略）
        fetch(API_AUTH + '?action=me').then(function (meRes) {
          if (!meRes.ok) return null;
          return meRes.json();
        }).then(function (meJson) {
          if (meJson && meJson.success && meJson.data.id === json.data.id) {
            document.getElementById('editProfileBtn').style.display = '';
          }
        }).catch(function () {});
      });
    }).catch(function () {
      status.textContent = '加载失败，请刷新重试';
    });
  });
})();
