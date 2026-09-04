FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

WORKDIR /worker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY handler.py .

# Both endpoints must have read/write access to this persistent location.
# Mount a protected network volume here or replace the filesystem helpers in
# handler.py with your object-storage implementation.
ENV ADAPTERS_ROOT=/workspace/adapters
CMD ["python", "-u", "handler.py"]
