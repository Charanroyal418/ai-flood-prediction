import re

file_path = "src/app/dashboard/predictions/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fonts and Global Style
font_style = """
<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
  .font-heading { font-family: 'Nunito', sans-serif !important; }
  .font-sans { font-family: 'Nunito', sans-serif !important; }
`}</style>
"""
content = content.replace('<div className="flex flex-col gap-6 p-2">', '<div className="flex flex-col gap-8 p-4 font-sans">' + font_style)

# Increase font sizes for StatCard
content = content.replace('text-[10px] text-text-secondary uppercase tracking-widest', 'text-xs text-text-secondary uppercase tracking-widest')
content = content.replace('text-[10px] text-text-secondary uppercase tracking-widest font-bold', 'text-xs text-text-secondary uppercase tracking-widest font-bold')
content = content.replace('text-[8px] text-text-secondary uppercase', 'text-[10px] text-text-secondary uppercase')
content = content.replace('text-[10px] text-text-secondary truncate mt-0.5', 'text-xs text-text-secondary truncate mt-1')

content = content.replace('text-sm xl:text-base font-heading font-extrabold', 'text-xl xl:text-2xl font-heading font-extrabold')
content = content.replace('text-xs font-bold text-text-primary tabular-nums', 'text-sm font-bold text-text-primary tabular-nums')
content = content.replace('text-base lg:text-lg font-heading font-extrabold', 'text-2xl lg:text-3xl font-heading font-extrabold')

# Card styling globally
content = content.replace('p-4 shadow-', 'p-6 shadow-')
content = content.replace('rounded-[20px]', 'rounded-3xl hover:-translate-y-1 transition-all duration-300 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)]')
content = content.replace('rounded-[24px]', 'rounded-[32px] hover:-translate-y-1 transition-all duration-300 shadow-[0_12px_32px_rgba(99,102,241,0.08)] hover:shadow-[0_20px_48px_rgba(99,102,241,0.15)]')
content = content.replace('bg-paper-100 rounded-[20px] p-6 flex flex-col shadow-sm', 'bg-paper-100 rounded-3xl p-8 flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)]')


# SHAP features empty space & size
content = content.replace('text-[11px] font-bold text-text-secondary w-28', 'text-sm font-bold text-text-secondary w-36')
content = content.replace('text-[12px] font-bold tabular-nums w-12', 'text-sm font-bold tabular-nums w-12')
content = content.replace('h-3 bg-paper-50', 'h-4 bg-paper-50')
content = content.replace('rounded-full overflow-hidden relative', 'rounded-full overflow-hidden relative shadow-inner')

shap_footer_old = """                  <div className="mt-2 pt-4 border-t border-line/60 flex items-center justify-between text-[11px] text-text-secondary font-medium">
                    <span>Top 5 drivers shown</span>
                    <button className="text-signal-600 font-bold hover:underline flex items-center gap-1">
                      View all features <ChevronRight className="w-3 h-3"/>
                    </button>
                  </div>"""

shap_footer_new = """                  <div className="mt-auto pt-6">
                    <div className="bg-signal-50/50 rounded-2xl p-4 border border-signal-100/50 flex flex-col gap-2 mb-4">
                      <p className="text-sm text-text-primary font-semibold">Rainfall and river level are the dominant risk drivers this cycle.</p>
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 shadow-sm"></span> Positive driver</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm"></span> Mitigating factor</div>
                      </div>
                    </div>
                    <div className="border-t border-line/60 pt-4 flex items-center justify-between text-xs text-text-secondary font-bold">
                      <span>Top 5 drivers shown</span>
                      <button className="text-signal-600 font-extrabold hover:underline flex items-center gap-1 transition-all hover:translate-x-1">
                        View all features <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>"""
content = content.replace(shap_footer_old, shap_footer_new)

# Page title
content = content.replace('text-2xl font-heading font-bold text-text-primary tracking-tight', 'text-4xl font-heading font-extrabold text-text-primary tracking-tight')

# Stat card labels in the grid
content = content.replace('w-10 h-10 rounded-[12px]', 'w-14 h-14 rounded-[20px]')
content = content.replace('w-5 h-5', 'w-7 h-7')
content = content.replace('text-[10px] text-text-secondary uppercase tracking-widest font-bold truncate', 'text-xs text-text-secondary uppercase tracking-widest font-bold truncate')

# Stat Card Background Icons
content = content.replace(
    "`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${accent ? 'bg-signal-50 text-signal-600' : 'bg-signal-50 text-signal-600'}`",
    "`w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 ${accent ? 'bg-indigo-100 text-indigo-600' : title === 'Model' ? 'bg-purple-100 text-purple-600' : title === 'Engine' ? 'bg-blue-100 text-blue-600' : title === 'Total Latency' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`"
)


# District list text
content = content.replace('font-bold text-sm truncate', 'font-bold text-base truncate')
content = content.replace('!text-[9px] !rounded-full', '!text-[11px] !rounded-full font-bold px-4 py-1.5')

# GDNN Risk Assessment card fonts
content = content.replace('text-[10px] text-text-secondary uppercase tracking-widest font-bold', 'text-xs text-text-secondary uppercase tracking-widest font-bold')
content = content.replace('text-4xl font-black text-text-primary', 'text-5xl lg:text-6xl font-black text-text-primary')
content = content.replace('text-2xl font-black tabular-nums tracking-tight mt-1', 'text-4xl font-black tabular-nums tracking-tight mt-2')
content = content.replace('text-lg px-6 py-2.5 rounded-full', 'text-xl px-8 py-3 rounded-full')
content = content.replace('p-6 relative overflow-hidden', 'p-8 relative overflow-hidden')

# Pipeline flow strip
content = content.replace('text-[11px] font-bold text-text-primary uppercase tracking-widest', 'text-sm font-bold text-text-primary uppercase tracking-widest')
content = content.replace('w-7 h-7 rounded-full', 'w-10 h-10 rounded-full')
content = content.replace('text-[11px] font-heading font-extrabold', 'text-sm font-heading font-extrabold')
content = content.replace('text-[10px] uppercase tracking-widest font-bold hidden md:block', 'text-xs uppercase tracking-widest font-bold hidden md:block mt-1')
content = content.replace('border-[3px]', 'border-[4px]')

# Temporal projection & logs headers
content = content.replace('text-[11px] font-bold uppercase tracking-widest flex items-center gap-2', 'text-sm font-bold uppercase tracking-widest flex items-center gap-2')
content = content.replace('text-[11px] font-bold uppercase tracking-widest', 'text-sm font-bold uppercase tracking-widest') # covers others

# Execution logs
content = content.replace('text-[10px] mt-[3px]', 'text-xs mt-[3px]')
content = content.replace('text-[11px] leading-relaxed', 'text-sm leading-relaxed')

# Gap modifications globally where there is a grid
content = content.replace('gap-6 items-stretch', 'gap-8 items-stretch')
content = content.replace('gap-4 mb-8', 'gap-6 mb-10')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Rewrite Complete!")
