import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2] if len(sys.argv)>2 else '/tmp/fg/shots'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,w,h,mob in [('desktop',1440,900,False),('mobile',390,844,True)]:
        ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=1 if not mob else 2,is_mobile=mob,has_touch=mob)
        ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=URL.split('/')[0]+'//'+URL.split('/')[2])
        pg=ctx.new_page(); pg.on('console',lambda m: m.type=='error' and errs.append(m.text)); pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto(URL,wait_until='networkidle'); pg.add_style_tag(content='html{scroll-behavior:auto!important}'); pg.wait_for_timeout(600)
        H=pg.evaluate('document.documentElement.scrollHeight')
        ov=pg.evaluate('''()=>{const W=document.documentElement.clientWidth;return [...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1&&r.width>0&&!e.closest('pre')&&getComputedStyle(e).position!=='fixed'}).slice(0,8).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right))}''')
        print(name,'height',H,'overflow',ov, 'scrollW', pg.evaluate('document.documentElement.scrollWidth'))
        for tag,frac in [('top',0),('mid',0.45),('end',1)]:
            pg.evaluate(f'window.scrollTo(0,{int(frac*H)})'); pg.wait_for_timeout(400)
            pg.screenshot(path=f'{OUT}/{name}_{tag}.png')
        # specific anchors
        for anc in ['#q01','#q09','#scorer','#q13','#evidence-sheet','#full-assessment']:
            pg.evaluate(f"document.querySelector('{anc}').scrollIntoView()"); pg.wait_for_timeout(350)
            pg.screenshot(path=f'{OUT}/{name}_{anc[1:]}.png')
        if name=='desktop':
            pg.evaluate("document.querySelector('#q02').scrollIntoView()"); pg.wait_for_timeout(200)
            pg.click('#q02 .copy'); pg.wait_for_timeout(300)
            clip=pg.evaluate('navigator.clipboard.readText()')
            print('clipboard starts:',repr(clip[:60]),'len',len(clip),'has &lt;:', '&lt;' in clip, 'has <:', '<' in clip)
            print('copied count:',pg.inner_text('.side-progress b'))
            # form
            pg.fill('#f-total','120000'); pg.fill('#f-traced','78000'); pg.fill('input[name=job1_name]','nightly_orders_load'); pg.fill('input[name=job1_owner]','data-eng'); pg.fill('input[name=job1_cost]','14000'); pg.select_option('select[name=job1_action]','Fix failures'); pg.fill('#f-failed','6000'); pg.fill('#f-asks','Example text for print test.')
            pg.fill('#sc-n0','orders_etl'); pg.check('#scorer-rows .scorer-row:first-child input[data-sig="2"]'); pg.wait_for_timeout(100)
            print('outcome row1:',pg.inner_text('#scorer-rows .scorer-row:first-child .outcome'))
            pg.click('#to-sheet'); pg.wait_for_timeout(200)
            print('calc:',[pg.inner_text(s) for s in ['#c-annual','#c-tracedpct','#c-gap','#c-top10pct','#c-failedpct']], 'keep1', pg.input_value('input[name=keep1_name]'), pg.input_value('select[name=keep1_out]'))
            pg.reload(wait_until='networkidle'); print('persisted total:',pg.input_value('#f-total'))
            pg.evaluate("document.documentElement.classList.add('print-sheet'); window.fgPreparePrint()")
            pg.emulate_media(media='print')
            pg.pdf(path=f'{OUT}/evidence_sheet_print.pdf',format='A4',print_background=True)
            pg.emulate_media(media='screen'); pg.evaluate("document.documentElement.classList.remove('print-sheet')")
            # clear test data
            pg.evaluate('localStorage.clear()')
        ctx.close()
    b.close()
print('errors',errs)
