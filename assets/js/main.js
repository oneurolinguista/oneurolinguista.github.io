document.addEventListener('DOMContentLoaded', function() {
    initHeader();
    initSmoothScroll();
    initActiveNav();
    initAccordion();
    initSlider();
    initCookieConsent();
    initVideos();
    initCurrentYear();
});

function initHeader() {
    const header = document.querySelector('.header');
    const mobileToggle = document.querySelector('.header__mobile-toggle');
    const nav = document.querySelector('.header__nav');
    const overlay = document.querySelector('.header__overlay');

    if (!header || !mobileToggle || !nav) return;

    let ticking = false;

    // Header só aparece no topo da página
    function onScroll() {
        const scrolled = window.scrollY > 0;
        header.classList.toggle('header--scrolled', scrolled);
        header.classList.toggle('header--hidden', scrolled);
        ticking = false;
    }

    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });

    function toggleMenu(open) {
        const isOpen = typeof open === 'boolean' ? open : !nav.classList.contains('header__nav--open');
        nav.classList.toggle('header__nav--open', isOpen);
        overlay?.classList.toggle('header__overlay--visible', isOpen);
        mobileToggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    mobileToggle.addEventListener('click', function() {
        toggleMenu();
    });

    overlay?.addEventListener('click', function() {
        toggleMenu(false);
    });

    nav.querySelectorAll('.header__menu-link').forEach(function(link) {
        link.addEventListener('click', function() {
            if (window.innerWidth < 992) {
                toggleMenu(false);
            }
        });
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth >= 992 && nav.classList.contains('header__nav--open')) {
            toggleMenu(false);
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && nav.classList.contains('header__nav--open')) {
            toggleMenu(false);
        }
    });
}

// Âncora dentro de uma grade com data-anchor-section: quando o card está na
// mesma linha dos outros (desktop), rola até a seção inteira; quando os cards
// estão empilhados (mobile), rola até o próprio card.
function resolveScrollTarget(target) {
    const sectionSelector = target.getAttribute('data-anchor-section');
    if (!sectionSelector) return target;

    const section = document.querySelector(sectionSelector);
    const firstInRow = target.parentElement.firstElementChild;
    const sameRow = Math.abs(target.offsetTop - firstInRow.offsetTop) < 2;
    return sameRow && section ? section : target;
}

function scrollToTarget(target, behavior) {
    const header = document.querySelector('.header');
    const headerHeight = header ? header.offsetHeight : 0;
    const top = resolveScrollTarget(target).getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({ top: top, behavior: behavior });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (!target) return;

            e.preventDefault();
            scrollToTarget(target, 'smooth');

            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            target.removeAttribute('tabindex');
        });
    });

    // Vindo de outra página (/#audios): o navegador pula direto para o
    // card, então reajusta com a mesma regra depois que as imagens carregam.
    const hashTarget = window.location.hash && document.querySelector(window.location.hash);
    if (hashTarget && hashTarget.hasAttribute('data-anchor-section')) {
        window.addEventListener('load', function() {
            scrollToTarget(hashTarget, 'instant');
        });
    }
}

function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.header__menu-link[href^="#"]');

    if (!sections.length || !navLinks.length) return;

    function onScroll() {
        const scrollY = window.scrollY + 100;

        sections.forEach(function(section) {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');

            if (scrollY >= top && scrollY < top + height) {
                navLinks.forEach(function(link) {
                    link.classList.toggle('header__menu-link--active', link.getAttribute('href') === '#' + id);
                });
            }
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function initAccordion() {
    const accordions = document.querySelectorAll('.accordion');

    accordions.forEach(function(accordion) {
        const triggers = accordion.querySelectorAll('.accordion__trigger');

        triggers.forEach(function(trigger) {
            trigger.addEventListener('click', function() {
                const panel = this.nextElementSibling;
                const isOpen = this.getAttribute('aria-expanded') === 'true';

                triggers.forEach(function(t) {
                    t.setAttribute('aria-expanded', 'false');
                    t.nextElementSibling?.setAttribute('hidden', '');
                });

                if (!isOpen) {
                    this.setAttribute('aria-expanded', 'true');
                    panel?.removeAttribute('hidden');
                }
            });
        });
    });
}

// Carrossel em movimento contínuo e lento (esteira). Os slides são duplicados
// para o loop ser infinito: ao percorrer o conjunto original, a posição volta
// uma "volta" para trás sem salto visível. Setas, toque e arrasto pausam por
// alguns segundos e o movimento continua de onde parou.
function initSlider() {
    const SPEED = 30; // px por segundo
    const RESUME_AFTER = 3000;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('.slider__track').forEach(function(track) {
        const viewport = track.querySelector('.slider__viewport');
        const container = track.querySelector('.slider__container');
        const prev = track.querySelector('.slider__btn--prev');
        const next = track.querySelector('.slider__btn--next');

        if (!viewport || !container) return;

        const originals = Array.from(container.children);
        if (!originals.length) return;

        originals.forEach(function(slide) {
            const clone = slide.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            container.appendChild(clone);
        });
        const firstClone = container.children[originals.length];

        let pos = 0;
        let last = null;
        let raf = null;
        let visible = false;
        let pausedUntil = 0;

        function loopWidth() {
            return firstClone.offsetLeft - originals[0].offsetLeft;
        }

        function slideStep() {
            const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
            return originals[0].offsetWidth + gap;
        }

        function frame(time) {
            raf = requestAnimationFrame(frame);
            const dt = last === null ? 0 : Math.min(time - last, 100) / 1000;
            last = time;

            if (performance.now() < pausedUntil) {
                pos = viewport.scrollLeft;
                return;
            }

            const width = loopWidth();
            pos += SPEED * dt;
            if (width > 0 && pos >= width) pos -= width;
            viewport.scrollLeft = pos;
        }

        function sync() {
            const shouldRun = visible && !document.hidden && !reduceMotion;
            if (shouldRun && !raf) {
                last = null;
                pos = viewport.scrollLeft;
                raf = requestAnimationFrame(frame);
            } else if (!shouldRun && raf) {
                cancelAnimationFrame(raf);
                raf = null;
            }
        }

        function pause() {
            pausedUntil = performance.now() + RESUME_AFTER;
        }

        function go(direction) {
            pause();
            const width = loopWidth();
            const step = slideStep();
            const maxScroll = viewport.scrollWidth - viewport.clientWidth;
            // salta uma volta antes de andar, para nunca bater na ponta
            if (direction < 0 && viewport.scrollLeft < step) {
                viewport.scrollLeft += width;
            } else if (direction > 0 && viewport.scrollLeft + step > maxScroll) {
                viewport.scrollLeft -= width;
            }
            viewport.scrollBy({ left: direction * step, behavior: 'smooth' });
        }

        prev?.addEventListener('click', function() { go(-1); });
        next?.addEventListener('click', function() { go(1); });

        viewport.addEventListener('pointerdown', pause);
        viewport.addEventListener('touchstart', pause, { passive: true });
        viewport.addEventListener('touchmove', pause, { passive: true });
        viewport.addEventListener('wheel', function(e) {
            // só rolagem horizontal (trackpad) conta; a vertical é a página rolando
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) pause();
        }, { passive: true });
        document.addEventListener('visibilitychange', sync);

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function(entries) {
                visible = entries[0].isIntersecting;
                sync();
            }).observe(track);
        } else {
            visible = true;
            sync();
        }
    });
}

// Consentimento de cookies (LGPD). O site em si não usa cookies de rastreamento;
// o consentimento libera conteúdo de terceiros (hoje, o player do YouTube).
// Para plugar analytics no futuro, ouça o evento 'cookieconsent' e só carregue
// o script quando detail.status === 'accepted'.
const CONSENT_KEY = 'oneurolinguista-cookie-consent';
let consentMemory = null;
let pendingVideo = null;

function getConsent() {
    try {
        return localStorage.getItem(CONSENT_KEY) || consentMemory;
    } catch (e) {
        return consentMemory;
    }
}

function setConsent(status) {
    consentMemory = status;
    try {
        localStorage.setItem(CONSENT_KEY, status);
    } catch (e) {
        // modo privado / armazenamento bloqueado: vale só nesta visita
    }
    document.dispatchEvent(new CustomEvent('cookieconsent', { detail: { status: status } }));
}

function initCookieConsent() {
    const policyLink = document.querySelector('a[href$="/politica-de-privacidade"]');
    const policyHref = policyLink ? policyLink.getAttribute('href') : '/politica-de-privacidade';

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Aviso de cookies');
    banner.hidden = true;
    banner.innerHTML =
        '<p class="cookie-banner__text">Este site usa cookies de terceiros (YouTube) para exibir os vídeos. ' +
        'Você escolhe se aceita. Saiba mais na <a href="' + policyHref + '">Política de Privacidade</a>.</p>' +
        '<div class="cookie-banner__actions">' +
        '<button type="button" class="btn btn--ghost-light" data-consent="declined">Recusar</button>' +
        '<button type="button" class="btn btn--primary" data-consent="accepted">Aceitar</button>' +
        '</div>';
    document.body.appendChild(banner);

    banner.addEventListener('click', function(e) {
        const button = e.target.closest('[data-consent]');
        if (!button) return;

        const status = button.getAttribute('data-consent');
        setConsent(status);
        banner.hidden = true;

        if (status === 'accepted' && pendingVideo) {
            embedVideo(pendingVideo);
        }
        pendingVideo = null;
    });

    document.querySelectorAll('[data-cookie-preferences]').forEach(function(button) {
        button.addEventListener('click', function() {
            banner.hidden = false;
            banner.querySelector('[data-consent="accepted"]').focus();
        });
    });

    if (!getConsent()) banner.hidden = false;

    window.showCookieBanner = function() {
        banner.hidden = false;
        banner.querySelector('[data-consent="accepted"]').focus();
    };
}

function embedVideo(facade) {
    const id = facade.getAttribute('data-video-id');
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    iframe.title = facade.getAttribute('data-video-title') || 'Vídeo do YouTube';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    facade.replaceWith(iframe);
    iframe.focus();
}

// Com consentimento: toca o vídeo na própria página. Recusado: segue o link e
// abre no YouTube. Sem escolha ainda: mostra o aviso e toca se a pessoa aceitar.
function initVideos() {
    document.querySelectorAll('.video-facade').forEach(function(facade) {
        facade.addEventListener('click', function(e) {
            const consent = getConsent();
            if (consent === 'declined') return;

            e.preventDefault();
            if (consent === 'accepted') {
                embedVideo(facade);
            } else {
                pendingVideo = facade;
                window.showCookieBanner?.();
            }
        });
    });
}

// Ano do copyright sempre atual (o HTML traz um ano fixo como reserva sem JS)
function initCurrentYear() {
    const year = new Date().getFullYear();
    document.querySelectorAll('[data-ano-atual]').forEach(function(el) {
        el.textContent = year;
    });
}
